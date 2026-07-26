import { log } from "./helpers/logger"
import { sendMessage } from "./helpers/session-helpers"
import type { Plugin } from "@opencode-ai/plugin"

import { SessionStorage, SESSION_FIELDS } from "./helpers/kv-store"
import { fetchAgentList, getSessionAgent, AgentInfo } from "./helpers/agent-steps"

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

export const toolLimitReminder: Plugin = async ({ client, $ }) => {
  await log(client, "info", "init", "tool-limit-reminder")

  /**
   * Per-agent tool call limits — dynamically resolved from client.app.agents().
   * Threshold = Math.floor(maxSteps * 0.8) for agents that have maxSteps.
   * Agents without maxSteps (or not in the agent list) are unlimited.
   */

  let _toolLimitsCache: Record<string, number> | undefined;

  const getToolLimits = async (): Promise<Record<string, number>> => {
    if (_toolLimitsCache) {
      return _toolLimitsCache;
    }

    const agentsList = await fetchAgentList(client)

    await log(client, "info", `fetched agent list: ${JSON.stringify(agentsList.map((a: AgentInfo) => ({ name: a.name, maxSteps: a.steps })))}`, "tool-limit-reminder")

    const toolLimits: Record<string, number> = Object.fromEntries(
      agentsList
        .filter((a) => typeof (a as { steps?: number }).steps === "number")
        .map((a: AgentInfo) => {
          const s = a.steps as number
          return [a.name, Math.floor(s * 0.8)]
        })
    ) as Record<string, number>
    _toolLimitsCache = toolLimits
    return toolLimits
  }

  // 2 extra calls beyond the threshold to account for the current call still being in-flight
  const PADDING_TILL_ERROR = 2

  /**
   * In-memory per-session counter tracking.
   * This Map is the SOURCE OF TRUTH for counting only.
   * sessionStorage persistence is one-way write-only — NEVER read from it for counting purposes.
   */
  const sessionCounters = new Map<string, number>()

  // Session storage for cross-plugin state persistence (needsReview flag)
  const sessionStorage = new SessionStorage()


  /**
    * Triggers an asynchronous export of the session using the shell helper.
    * Runs `just agent_utils/export-opencode-session <sessionId>` from workspace root.
    */
  const triggerExport = async (sessionId: string) => {
    try {
      const result = await ($`just agent_utils/export-opencode-session ${sessionId}`).nothrow().quiet().json()
      void log(client, "info", `export completed for session ${sessionId}: ${JSON.stringify(result)}`, "tool-limit-reminder")
    } catch (error: unknown) {
      const errorString = (error as Error)?.message ?? String(error)
      void log(client, "error", `failed to trigger export for session ${sessionId}: ${errorString}`, "tool-limit-reminder")
    }
  }

  return {
    "event": async ({ event }: { event: { type: string; properties?: Record<string, unknown> } }) => {
      if (event.type !== "session.idle" || !event.properties?.sessionID) {
        return
      }

      sessionCounters.delete(event.properties.sessionID as string)
      await log(client, "info", `session ${event.properties.sessionID} idle — cleared tool call counter`, "tool-limit-reminder")

      const idleSessionId = event.properties.sessionID as string

      // Check if this session was flagged for review
      const hasReviewFlag = sessionStorage.readState(
        idleSessionId,
        (state) => state[SESSION_FIELDS.needsReview] === true
      )

      if (!hasReviewFlag) {
        return  // Session not flagged; no export needed
      }

      await log(client, "info", `session ${idleSessionId} idle with needsReview flag — triggering export`, "tool-limit-reminder")

      try {
        triggerExport(idleSessionId)
        // Clear the review flag after triggering (so we don't re-export on subsequent idle events)
        sessionStorage.updateState(idleSessionId, (state) => {
          const { [SESSION_FIELDS.needsReview]: _, ...next } = state as Record<string, unknown>
          return next
        })
      } catch (error) {
        await log(client, "error", `failed to trigger export for session ${idleSessionId}: ${(error as Error).message}`, "tool-limit-reminder")
      }


    },
    dispose: async () => {
      void log(client, "info", "dispose", "tool-limit-reminder")
    },
    "tool.execute.before": async (input: ToolExecuteBeforeInput) => {
      if (!input.sessionID) {
        await log(client, "warn", "missing sessionID in tool.execute.before input", "tool-limit-reminder")
        return
      }

      const sessionID = input.sessionID

      // Resolve agent name via shared helper
      const agentName = await getSessionAgent(client, sessionID)

      await log(client, "info", `sessionID: ${sessionID}, agent: ${agentName}`, "tool-limit-reminder")

      const TOOL_LIMITS = await getToolLimits()

      if (!TOOL_LIMITS.hasOwnProperty(agentName)) {
        await log(client, "info", `agent ${agentName} not listed in TOOL_LIMITS, skipping limit check`, "tool-limit-reminder")
        // Agent not listed in TOOL_LIMITS → unlimited (skip threshold logic entirely).
        return
      }

      // SOURCE OF TRUTH: read count from in-memory Map ONLY
      const currentCount = sessionCounters.get(sessionID) ?? 0

      const agentReminderThreshold = TOOL_LIMITS[agentName]

      await log(client, "info", `sessionID: ${sessionID}, agent: ${agentName}, currentCount: ${currentCount}, threshold: ${agentReminderThreshold}`, "tool-limit-reminder")

      sessionCounters.set(sessionID, currentCount + 1)

      // Diagnostic log — fires for limited agents to indicate tracking is active
      await log(client, "warn", `reached tool call limit of ${agentReminderThreshold}`, "tool-limit-reminder")

      // ── Threshold enforcement tiers ──────────────────────────────────

      if (currentCount > agentReminderThreshold + PADDING_TILL_ERROR) {
        // BLOCK: hard limit exceeded — stop execution immediately
        await log(client, "error", `tool call limit exceeded for session ${sessionID}. Current count: ${currentCount + 1}, Limit: ${agentReminderThreshold}`, "tool-limit-reminder")
        throw new Error(`Error calling tools. Reason: tools are blocked. STOP YOUR WORK. DON'T change, read, write files, execute commands in this session. Follow the instructions in the previous message to summarize your work and stop.`)
      }

      if (currentCount > agentReminderThreshold) {
        // NEEDS REVIEW: above threshold but within padding tolerance
        await log(client, "info", `flagging session ${sessionID} for review`, "tool-limit-reminder")
        sessionStorage.updateState(sessionID, (state) => ({ ...state, [SESSION_FIELDS.needsReview]: true }))
        const message = `<steering priority="warning" reason="tool call limit exceeded" type="instructions">
STOP!
You have exceeded the tool call limit for this agent. Current count: ${currentCount + 1}, Limit: ${agentReminderThreshold}
Your work will be exported for review when the session goes idle.
</steering>`
        await sendMessage({
          client,
          sessionId: sessionID,
          message,
          noReply: true,
        })
      }

      if (currentCount === agentReminderThreshold) {
        // REMINDER: at the exact threshold — warn the agent with full instructions
        const message = `<steering priority="warning" reason="tool call limit reached" type="instructions">
STOP!
DO NOT CALL ANY OTHER TOOLS, DON'T change, read, write files, execute commands in this session. You have reached the tool call limit for this agent.

You've exhausted the task budget for this iteration. You've made ${currentCount} tool calls which is the limit.

Ignoring this instruction will result in progress lost.

Output the summary:
- What you have done so far
- What problems you encountered
- What worked and what did not work
- What is left to do
- What you could've done if you got more time
</steering>`

        await sendMessage({
          client,
          sessionId: sessionID,
          message,
          noReply: true,
        })
      }

      // Below threshold: do nothing special
    },
  } as Record<string, (...arguments_: unknown[]) => void>
}
