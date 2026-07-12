import { log } from "./helpers/logger"
import { sendMessage } from "./helpers/session-helpers"
import type { Plugin } from "@opencode-ai/plugin"

/**
 * Per-agent tool call limits.
 * NOTE: Since no reliable public API exists to resolve the active agent
 * within a tool.execute.before hook (the input only provides `tool`,
 * `sessionID`, and `callID`), this falls back to a global threshold
 * applied uniformly to all agents. The map is preserved as specified so
 * that future agent-specific overrides can be added if a resolution API
 * becomes available in OpenCode.
 */


interface ToolExecuteBeforeInput {
  sessionID?: string
  tool?: string
  callID?: string
}

export const toolLimitReminder: Plugin = async ({ client }) => {
  await log(client, "info", "[tool-limit-reminder] init")

  const TOOL_LIMITS: Record<string, number> = {
    "rug-swe": 20,
    "rug-mcp": 6,
    "rug-expert": 15,
    "rug-puppet": 6
  }

  const PADDING_TILL_ERROR = 2

  /**
   * In-memory per-session counter tracking.
   * This Map is the SOURCE OF TRUTH for counting only.
   * sessionStorage persistence is one-way write-only — NEVER read from it for counting purposes.
   */
  const sessionCounters = new Map<string, number>()

  return {
    dispose: async () => {
      void log(client, "info", "[tool-limit-reminder] dispose")
    },
    "tool.execute.before": async (input: ToolExecuteBeforeInput) => {
      if (!input.sessionID) {
        await log(client, "warn", "[tool-limit-reminder] missing sessionID in tool.execute.before input")
        return
      }

      const sessionID = input.sessionID

      const sessionInfo = await client.session.get({ path: { id: sessionID } }) as { data?: { agent?: string } }

      const agentName = sessionInfo?.data?.agent ?? 'build' // Default agent if not specified

      await log(client, "info", `[tool-limit-reminder] sessionID: ${sessionID}, agent: ${agentName}`)

      if (!TOOL_LIMITS.hasOwnProperty(agentName)) {

        await log(client, "info", `[tool-limit-reminder] agent ${agentName} not listed in TOOL_LIMITS, skipping limit check`)
        // Agent not listed in TOOL_LIMITS → unlimited (skip threshold logic entirely).
        return
      }

      // SOURCE OF TRUTH: read count from in-memory Map ONLY
      const currentCount = sessionCounters.get(sessionID) ?? 0

      const agentReminderThreshold = TOOL_LIMITS[agentName]

      await log(client, "info", `[tool-limit-reminder] sessionID: ${sessionID}, agent: ${agentName}, currentCount: ${currentCount}, threshold: ${agentReminderThreshold}`)

      sessionCounters.set(sessionID, currentCount + 1)


      await log(client, "warn", `[tool-limit-reminder] reached tool call limit of ${agentReminderThreshold}`)

      if (currentCount > agentReminderThreshold + PADDING_TILL_ERROR) {
        await log(client, "error", `[tool-limit-reminder] tool call limit exceeded for session ${sessionID}. Current count: ${currentCount + 1}, Limit: ${agentReminderThreshold}`)
        throw new Error(`DO NOT call any more tools, scope creep detected. Perform handoff!`)
      }

      if (currentCount !== agentReminderThreshold) {
        await log(client, "info", `[tool-limit-reminder] sessionID: ${sessionID}, agent: ${agentName}, currentCount: ${currentCount}, threshold: ${agentReminderThreshold}`)
        return
      }

      const message = `<steering reason="Scope Creep Detected" severity="warning">
STOP!
DO NOT CALL ANY OTHER TOOLS, DON'T change, read, write files, execute commands in this session. You have reached the tool call limit for this agent.

You've exhausted the task budget for this iteration. You've made ${currentCount} tool calls which is the limit.

Ignoring this instruction will result in progress lost.

Output the summary:
- What you have done so far
- What problems you encountered
- What worked and what did not work.
- What is left to do.
</steering>`

      await sendMessage({
        client,
        sessionId: sessionID,
        message,
        noReply: true
      })
    },
  } as Record<string, (...args: unknown[]) => void>
}
