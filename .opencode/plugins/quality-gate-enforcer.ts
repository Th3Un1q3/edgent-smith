import { Plugin } from "@opencode-ai/plugin"
import type { OpencodeClient } from "@opencode-ai/sdk"
import { loadQualityGates } from "./helpers/gate-config"
import { runGate } from "./helpers/gate-runner"
import { isGlobMatch } from "./helpers/glob-match"
import type { CommandResult, Shell } from "./helpers/gate-runner"
import { SessionStorage } from "./helpers/kv-store"
import { sendMessage } from "./helpers/session-helpers"
import { formatGateBatchResults } from "./helpers/gate-formatter"
import { log } from "./helpers/logger"
import type { GateConfig, GateResult, GateRunOutcome } from "./types/quality-gate"

function extractFilePath(input: { args?: { filePath?: string } }, workspaceRoot: string): string | undefined {
  if (typeof input.args?.filePath !== "string") return undefined
  const absPath = input.args.filePath
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
    Record<string, { dirty?: boolean; status: GateResult }> | undefined
  if (!statuses) return {}
  return Object.fromEntries(
    Object.entries(statuses).map(([name, entry]) => [name, entry.status]),
  )
}

export const qualityGateEnforcer: Plugin = async ({ client, directory, $ }) => {
  const resolvedDirectory = directory ?? "/workspace"
  const qualityGatesConfig = await loadQualityGates(resolvedDirectory, client)
  const gates = qualityGatesConfig.gates
  const sessionStorage = new SessionStorage()
  const targetedTools = new Set(["edit", "write"])

  // eslint-disable-next-line unicorn/consistent-function-scoping -- must be inner closure: sendMessage is mocked in tests
  async function sendTransitionMessage(
    outcomes: GateRunOutcome[],
    sessionID: string | undefined,
    client: OpencodeClient,
  ): Promise<void> {
    if (outcomes.length === 0) return
    const message = formatGateBatchResults(outcomes)
    void log(client, "info", `[quality-gate-enforcer] Sending transition message for ${outcomes.length} gate(s)`)
    if (sessionID) {
      await sendMessage({ client, sessionId: sessionID, message, noReply: true })
    } else {
      void log(client, "info", message)
    }
  }

  return {
    "tool.execute.after": async (input, _output) => {
      if (!targetedTools.has(input.tool)) return

      const filePath = extractFilePath(input, resolvedDirectory)
      if (!filePath) return

      const matchedGates = findMatchingGates(gates, filePath)
      if (matchedGates.length === 0) return

      const sessionID = input.sessionID
      const gateStatuses = readGateStatuses(sessionID, sessionStorage)
      const outcomes: GateRunOutcome[] = []

      for (const gate of matchedGates) {
        const oldStatus = gateStatuses[gate.name] ?? "unknown"

        // Mark dirty before running — signals that gate evaluation is in progress
        if (sessionID) {
          sessionStorage.updateState(sessionID, (state: Record<string, unknown>) => ({
            ...(state as Record<string, unknown>),
            qualityGateStatuses: {
              ...((state as Record<string, unknown>).qualityGateStatuses as Record<string, { dirty: boolean; status: GateResult }> | undefined),
              [gate.name]: { dirty: true, status: oldStatus },
            },
          }))
        }

        let result: CommandResult
        try {
          const raw = await runGate(gate, $ as unknown as Shell)
          result = raw ?? { exitCode: 1, stdout: "", stderr: "Gate returned no result" }
        } catch (error: unknown) {
          result = { exitCode: 1, stdout: "", stderr: String(error) }
        }

        const newStatus: GateResult = result.exitCode === 0 ? "pass" : "fail"

        if (sessionID) {
          sessionStorage.updateState(sessionID, (state: Record<string, unknown>) => ({
            ...(state as Record<string, unknown>),
            qualityGateStatuses: {
              ...((state as Record<string, unknown>).qualityGateStatuses as Record<string, { dirty: boolean; status: GateResult }> | undefined),
              [gate.name]: { dirty: false, status: newStatus },
            },
          }))
        }

        if (oldStatus !== newStatus) {
          outcomes.push({ gate, previousStatus: oldStatus, newStatus, result })
        }
      }

      await sendTransitionMessage(outcomes, sessionID, client)
    },
  }
}
