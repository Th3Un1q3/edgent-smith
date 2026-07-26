import type { Plugin } from "@opencode-ai/plugin"
import { log } from "./helpers/logger"
import { SessionStorage, SESSION_FIELDS } from "./helpers/kv-store"

export const sessionTracker: Plugin = async ({ client }) => {
  const sessionStorage = new SessionStorage()
  await log(client, "info", "session-tracker initialized", "session-tracker")

  async function setSessionField(sessionId: string, field: string, value: unknown = new Date().toISOString()): Promise<void> {
    await sessionStorage.updateState(sessionId, (state: Record<string, unknown>) => ({
      ...state,
      [field]: value,
    }))
  }

  async function markSessionAsStarted(sessionId: string): Promise<void> {
    await sessionStorage.updateState(sessionId, (state: Record<string, unknown>) => {
      if (Object.hasOwn(state, SESSION_FIELDS.startedAt)) return state
      return { ...state, [SESSION_FIELDS.startedAt]: new Date().toISOString() }
    })
  }

  return {
    "chat.message": async ({ sessionID, agent }) => {
      if (!sessionID || !agent) return
      void markSessionAsStarted(sessionID)
      void setSessionField(sessionID, SESSION_FIELDS.agent, agent)
      void setSessionField(sessionID, SESSION_FIELDS.lastMessageSentAt)
    },

    "tool.execute.before": async (input, _output) => {
      if (!input.sessionID) return
      const existingToolCalls = sessionStorage.readState(
        input.sessionID,
        (s) => (s as Record<string, unknown>)[SESSION_FIELDS.toolCalls] as Record<string, string> | undefined,
      )
      void setSessionField(input.sessionID, SESSION_FIELDS.toolCalls, {
        ...existingToolCalls,
        [input.tool]: new Date().toISOString(),
      })
    },

    event: async ({ event }) => {
      if (typeof event.properties !== "object") throw new TypeError("event.properties is not an object")

      if (event.type === "session.error" && event.properties.sessionID && event.properties.error?.name === "MessageAbortedError") {
        void setSessionField(event.properties.sessionID, SESSION_FIELDS.cancelledAt)
      }

      if (event.type === "session.idle" && event.properties.sessionID) {
        void setSessionField(event.properties.sessionID, SESSION_FIELDS.idleAt)
      }
    },

    dispose: async () => { log(client, "info", "session-tracker disposed", "session-tracker") },
  }
}
