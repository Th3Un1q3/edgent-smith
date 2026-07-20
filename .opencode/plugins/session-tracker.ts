import type { Plugin } from "@opencode-ai/plugin"
import { log } from "./helpers/logger"
import { SessionStorage, SESSION_FIELDS } from "./helpers/kv-store"

const PLUGIN_ID = "harness-plugin"

export const sessionTracker: Plugin = async ({ client }) => {
  const sessionStorage = new SessionStorage()
  await log(client, "info", `${PLUGIN_ID} initialized`)

  const markSessionAsStarted = (sessionId: string, agent: string) => sessionStorage.updateState(sessionId, (session) => {
    if (Object.hasOwn(session, SESSION_FIELDS.startedAt)) return session
    return { ...session, [SESSION_FIELDS.startedAt]: new Date().toISOString(), [SESSION_FIELDS.agent]: agent }
  })

  const markToolAsCalled = (sessionId: string, tool: string) => sessionStorage.updateState(sessionId, (session) => {
    const toolCalls = session[SESSION_FIELDS.toolCalls] || {}
    return { ...session, [SESSION_FIELDS.toolCalls]: { ...toolCalls, [tool]: new Date().toISOString() } }
  })

  const recordLastSessionIdle = (sessionId: string) => sessionStorage.updateState(sessionId, (session) => {
    return { ...session, [SESSION_FIELDS.idleAt]: new Date().toISOString() }
  })

  const recordMessageCancelled = (sessionId: string) => sessionStorage.updateState(sessionId, (session) => {
    return { ...session, [SESSION_FIELDS.cancelledAt]: new Date().toISOString() }
  })

  const recordLastMessageSent = (sessionId: string) => sessionStorage.updateState(sessionId, (session) => {
    return { ...session, [SESSION_FIELDS.lastMessageSentAt]: new Date().toISOString() }
  })

  return {
    "chat.message": async ({ sessionID, agent }) => {
      if (!sessionID || !agent) return
      markSessionAsStarted(sessionID, agent)
      recordLastMessageSent(sessionID)
    },

    "tool.execute.before": async (input, _output) => {
      if (!input.sessionID) return
      markToolAsCalled(input.sessionID, input.tool)
    },

    event: async ({ event }) => {
      if (event.type === "session.error" && event.properties.sessionID && event.properties.error?.name === "MessageAbortedError") {
        recordMessageCancelled(event.properties.sessionID)
      }

      if (event.type === "session.idle" && event.properties.sessionID) {
        recordLastSessionIdle(event.properties.sessionID)
      }
    },

    dispose: async () => { log(client, "info", `${PLUGIN_ID} disposed`) },
  }
}
