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
import type { GateConfig, GateResult, GateRunOutcome, GateStateEntry } from "./types/quality-gate"

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

async function sendTransitionMessage(
  outcomes: GateRunOutcome[],
  sessionID: string | undefined,
  client: OpencodeClient,
  isPreChange?: boolean,
): Promise<void> {
  if (outcomes.length === 0) return
  const message = formatGateBatchResults(outcomes, isPreChange)
  void log(client, "info", `Sending transition message for ${outcomes.length} gate(s)`, "quality-gate-enforcer")
  if (sessionID) {
    await sendMessage({ client, sessionId: sessionID, message, noReply: true })
  } else {
    void log(client, "info", message)
  }
}

export const qualityGateEnforcer: Plugin = async ({ client, directory, $ }) => {
  const gatesState: Record<string, GateStateEntry> = {}

  const resolvedDirectory = directory ?? "/workspace"
  const qualityGatesConfig = await loadQualityGates(resolvedDirectory, client)
  const gates = qualityGatesConfig.gates
  const sessionStorage = new SessionStorage()
  const targetedTools = new Set(["edit", "write"])

  const readGateStatuses = (
    sessionID: string | undefined,
    sessionStorage: SessionStorage,
  ): Record<string, GateResult> => {
    const result: Record<string, GateResult> = {}
    for (const [name, entry] of Object.entries(gatesState)) {
      result[name] = entry.lastStatus
    }
    if (sessionID) {
      const state = sessionStorage.readState(sessionID, (s) => s as Record<string, unknown>)
      const statuses = state?.qualityGateStatuses as
        Record<string, { dirty?: boolean; status: GateResult }> | undefined
      if (statuses) {
        for (const [name, entry] of Object.entries(statuses)) {
          if (!Object.hasOwn(result, name)) {
            result[name] = entry.status
          }
        }
      }
    }
    return result
  }

  const pendingRuns = new Map<string, Promise<CommandResult>>()
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const beforeTransitionSent = new Set<string>()

  const runGatePooled = (gate: GateConfig): Promise<CommandResult> => {
    const existing = pendingRuns.get(gate.name)
    if (existing) return existing

    const debounceMs = qualityGatesConfig.debounceMs ?? 0

    const execute = async (): Promise<CommandResult> => {
      try {
        const raw = await runGate(gate, $ as unknown as Shell)
        return raw ?? { exitCode: 1, stdout: "", stderr: "Gate returned no result" }
      } catch (error: unknown) {
        return { exitCode: 1, stdout: "", stderr: String(error) }
      } finally {
        pendingRuns.delete(gate.name)
      }
    }

    const promise: Promise<CommandResult> = debounceMs > 0
      ? new Promise(resolve => {
          const timer = debounceTimers.get(gate.name)
          if (timer) clearTimeout(timer)
          debounceTimers.set(gate.name, setTimeout(async () => {
            debounceTimers.delete(gate.name)
            resolve(await execute())
          }, debounceMs))
        })
      : execute()

    pendingRuns.set(gate.name, promise)
    return promise
  }

  return {
    "tool.execute.before": async (
      input,
      output,
    ) => {
      if (typeof input.tool !== "string" || !targetedTools.has(input.tool)) return

      const filePath = extractFilePath(
        { args: output?.args as { filePath?: string } | undefined },
        resolvedDirectory,
      )
      if (!filePath) return

      const matchedGates = findMatchingGates(gates, filePath)
      if (matchedGates.length === 0) return

      const sessionID = input.sessionID
      const gateStatuses = readGateStatuses(sessionID, sessionStorage)
      const outcomes: GateRunOutcome[] = []

      for (const gate of matchedGates) {
        const currentStatus = gateStatuses[gate.name] ?? "unknown"
        if (currentStatus !== "unknown") continue

        const result = await runGatePooled(gate)
        const newStatus: "pass" | "fail" = result.exitCode === 0 ? "pass" : "fail"

        if (sessionID) {
          gatesState[gate.name] = {
            lastStatus: newStatus,
            lastExecutedAt: new Date(),
            lastStdOut: result.stdout,
            affectedSessions: [sessionID],
          }
          if (newStatus === "pass") {
            gatesState[gate.name].affectedSessions = []
          }
        }

        if ((newStatus as GateResult) !== currentStatus && !beforeTransitionSent.has(gate.name)) {
          beforeTransitionSent.add(gate.name)
          outcomes.push({ gate, previousStatus: currentStatus, newStatus, result })
        }
      }

      if (outcomes.length > 0) {
        await sendTransitionMessage(outcomes, sessionID, client, true)
      }
    },
    "tool.execute.after": async (input, output) => {
      if (input.tool === "task") {
        const childSessionID = (output.metadata as Record<string, unknown> | undefined)?.sessionId as string | undefined
        if (!childSessionID) return

        const state = sessionStorage.readState(childSessionID, (s) => s as Record<string, unknown>)
        if (!state) return

        const gateStatuses = state.qualityGateStatuses as
          Record<string, { dirty: boolean; status: string }> | undefined
        if (!gateStatuses) return

        const failingGates = Object.entries(gateStatuses)
          .filter(([_, info]) => info.status === "fail")
          .map(([name]) => name)

        if (failingGates.length === 0) return

        const failMessage = `\n\n⚠️ FAILING QUALITY GATES: ${failingGates.join(", ")}`
        output.output = (output.output || "") + failMessage
        return
      }

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

        const result = await runGatePooled(gate)

        const newStatus: "pass" | "fail" = result.exitCode === 0 ? "pass" : "fail"

        gatesState[gate.name] = {
          lastStatus: newStatus,
          lastExecutedAt: new Date(),
          lastStdOut: result.stdout,
          affectedSessions: sessionID ? [...(gatesState[gate.name]?.affectedSessions ?? []), sessionID].filter(
            (s, index, array) => array.indexOf(s) === index,
          ) : [],
        }

        if (newStatus === "pass") {
          gatesState[gate.name].affectedSessions = []
        }

        if (oldStatus !== newStatus) {
          outcomes.push({ gate, previousStatus: oldStatus, newStatus, result })
        }
      }

      await sendTransitionMessage(outcomes, sessionID, client)
    },
  }
}
