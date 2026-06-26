import type { Plugin } from "@opencode-ai/plugin"
import { log } from "./helpers/logger.ts"
import { updateState, readState, SESSION_FIELDS } from "./helpers/kv-store.ts"

const PLUGIN_ID = "harness-plugin"

export const sessionTracker: Plugin = async ({ client, project, directory }) => {
  await log(client, "info", `${PLUGIN_ID} initialized`)

  const markSessionAsStarted = (sessionId: string) => updateState(sessionId, (session) => {
    if (session[SESSION_FIELDS.startedAt]) return session
    return { ...session, [SESSION_FIELDS.startedAt]: new Date().toISOString() }
  })

  const recordLastSessionIdle = (sessionId: string) => updateState(sessionId, (session) => {
    return { ...session, [SESSION_FIELDS.idleAt]: new Date().toISOString() }
  })

  const recordMessageCancelled = (sessionId: string) => updateState(sessionId, (session) => {
    return { ...session, [SESSION_FIELDS.cancelledAt]: new Date().toISOString() }
  })

  const recordLastMessageSent = (sessionId: string) => updateState(sessionId, (session) => {
    return { ...session, [SESSION_FIELDS.lastMessageSentAt]: new Date().toISOString() }
  })

  return {
    "chat.message": async ({ sessionID }) => {
      markSessionAsStarted(sessionID)
      recordLastMessageSent(sessionID)
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
