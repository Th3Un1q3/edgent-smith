import { Plugin } from "@opencode-ai/plugin"
import type { OpencodeClient } from "@opencode-ai/sdk"
import { loadQualityGates } from "./helpers/gate-config"
import { createDirtyGateBatcher, runGate } from "./helpers/gate-runner"
import { isGlobMatch } from "./helpers/glob-match"
import type { CommandResult, Shell } from "./helpers/gate-runner"
import { SessionStorage } from "./helpers/kv-store"
import { sendMessage } from "./helpers/session-helpers"
import { formatGateBatchResults } from "./helpers/gate-formatter"
import { log } from "./helpers/logger"
import type { GateConfig, GateResult, GateRunOutcome } from "./types/quality-gate"

// ── Helpers ───────────────────────────────────────────────────────────────

function extractFilePath(input: { args?: { filePath?: string } }, workspaceRoot: string): string | undefined {
  if (typeof input.args?.filePath !== "string") return undefined
  const absPath = input.args.filePath
  // Normalize to workspace-relative path so glob patterns match consistently
  const prefix = workspaceRoot.endsWith("/") ? workspaceRoot : workspaceRoot + "/"
  return absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath
}

function findMatchingGates(gates: GateConfig[], filePath: string): GateConfig[] {
  return gates.filter((gate) =>
    gate.patterns.some((pattern) => isGlobMatch(pattern, filePath)),
  )
}

function readGateStatuses(
  sessionID: string | undefined,
  sessionStorage: SessionStorage,
): Record<string, GateResult> {
  if (!sessionID) return {}
  const state = sessionStorage.readState(sessionID, (s) => s as Record<string, unknown>)
  const statuses = state?.qualityGateStatuses as
    Record<string, { status: GateResult }> | undefined
  if (!statuses) return {}
  return Object.fromEntries(
    Object.entries(statuses).map(([name, entry]) => [name, entry.status]),
  )
}

// ── Plugin ────────────────────────────────────────────────────────────────

export const qualityGateEnforcer: Plugin = async ({ client, directory, $ }) => {
  const resolvedDirectory = directory ?? "/workspace"
  const qualityGatesConfig = await loadQualityGates(resolvedDirectory, client)
  const gates = qualityGatesConfig.gates
  const sessionStorage = new SessionStorage()

  const targetedTools = new Set(["edit", "write"])

  let lastSessionID: string | undefined

  async function evaluateDirtyGates(
    dirtyGateNames: string[],
    gates: GateConfig[],
    gateStatuses: Record<string, GateResult>,
    sessionID: string | undefined,
    sessionStorage: SessionStorage,
    shell: Shell,
  ): Promise<GateRunOutcome[]> {
    const outcomes: GateRunOutcome[] = []

    for (const gateName of dirtyGateNames) {
      const gate = gates.find((g) => g.name === gateName)
      if (!gate) continue

      const oldStatus = gateStatuses[gateName] ?? "unknown"

      let result: CommandResult
      try {
        const raw = await runGate(gate, shell)
        result = raw ?? { exitCode: 1, stdout: "", stderr: "Gate returned no result" }
      } catch (error: unknown) {
        result = { exitCode: 1, stdout: "", stderr: String(error) }
      }

      const newStatus: GateResult = result.exitCode === 0 ? "pass" : "fail"

      if (sessionID) {
        sessionStorage.updateState(sessionID, (state: Record<string, unknown>) => {
          const existing = (state as Record<string, unknown>).qualityGateStatuses as
            Record<string, { dirty: boolean; status: string }> | undefined
          return {
            ...(state as Record<string, unknown>),
            qualityGateStatuses: {
              ...existing,
              [gateName]: { dirty: false, status: newStatus },
            },
          }
        })
      }

      if (oldStatus !== newStatus) {
        outcomes.push({ gate, previousStatus: oldStatus, newStatus, result })
      }
    }

    return outcomes
  }

       
   
  async function sendTransitionMessage(
    outcomes: GateRunOutcome[],
    sessionID: string | undefined,
    client: OpencodeClient,
  ): Promise<void> {
    if (outcomes.length === 0) return

    const message = formatGateBatchResults(outcomes)

    void log(client, "info", `[quality-gate-enforcer] Sending transition message for ${outcomes.length} gate(s) to session ${sessionID}`)

    if (sessionID) {
      await sendMessage({ client, sessionId: sessionID, message, noReply: true })
      void log(client, "info", `[quality-gate-enforcer] Transition message sent to session ${sessionID}`)
    } else {
      void log(client, "info", message)
    }
  }

  const batcher = createDirtyGateBatcher({
    maxQuietMs: 10_000,
    onBatch: async (dirtyGateNames: string[]) => {
      void log(client, "info", `[quality-gate-enforcer] onBatch fired with ${dirtyGateNames.length} dirty gate(s): ${dirtyGateNames.join(", ")}`)
      const sessionID = lastSessionID
      const gateStatuses = readGateStatuses(sessionID, sessionStorage)
      const outcomes = await evaluateDirtyGates(
        dirtyGateNames,
        gates,
        gateStatuses,
        sessionID,
        sessionStorage,
        $ as unknown as Shell,
      )
      await sendTransitionMessage(outcomes, sessionID, client)
    },
  })

  void log(client, "info", `[quality-gate-enforcer] Initialized with ${gates.length} gate(s): ${gates.map(g => g.name).join(", ") || "(none)"}`)

  return {
    setup: async () => {
      // Reserved for runtime re-initialization if needed.
    },

    "tool.execute.after": async (input, _output) => {
      if (!targetedTools.has(input.tool)) return

      const filePath = extractFilePath(input, resolvedDirectory)
      if (!filePath) return

      lastSessionID = input.sessionID

      const matchedGates = findMatchingGates(gates, filePath)
      if (matchedGates.length === 0) return

      // Mark dirty in KV and classify gates for execution strategy
      const unknownGateNames: string[] = []
      const knownGateNames: string[] = []

      if (input.sessionID) {
        sessionStorage.updateState(input.sessionID, (state: Record<string, unknown>) => {
          const existing = (state as Record<string, unknown>).qualityGateStatuses as
            Record<string, { dirty: boolean; status: string }> | undefined
          const newStatuses = { ...existing }
          for (const gate of matchedGates) {
            const current = newStatuses[gate.name] ?? { dirty: false, status: "unknown" }
            newStatuses[gate.name] = { ...current, dirty: true }
            if (current.status === "unknown") {
              unknownGateNames.push(gate.name)
            } else {
              knownGateNames.push(gate.name)
            }
          }
          return { ...(state as Record<string, unknown>), qualityGateStatuses: newStatuses }
        })
      }

      if (unknownGateNames.length > 0) {
        batcher.markDirty(unknownGateNames)
        batcher.flush()
      }
      if (knownGateNames.length > 0) {
        batcher.markDirty(knownGateNames)
      }

      if (!input.sessionID) {
        void log(client, "info", `Matched gates: ${matchedGates.map((g) => g.name).join(", ")}`)
      }
    },

    dispose: async () => {
      batcher.dispose()
    },
  }
}
