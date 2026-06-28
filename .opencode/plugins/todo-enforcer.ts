
import { Plugin } from "@opencode-ai/plugin"
import { log } from "./helpers/logger"
import { sendMessage } from "./helpers/session-helpers"
import { readState, updateState, SESSION_FIELDS } from "./helpers/kv-store"


const PLUGIN_ID = "todo-enforcer"

type Todo = {
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
}

/** Build the todo continuation message for pending/in-progress todos. */
function buildTodoContinuationMessage(todos: Array<Todo>): string {
  return `There are incomplete todos:
${todos.map((todo) => "[ ] " + todo.content).join("\n")}

Proceed with the following steps:
1. Review the pending todos.
2. Add todos for any missing tasks that need to be completed.
3. Mark completed todos as such.
4. Complete the todos that have no blockers.
5. If any todo requires user input, use the question tool to ask for it.
`
}

export const todoEnforcer: Plugin = async ({ client, project, $, directory, worktree }) => {
  await log(client, "info", `${PLUGIN_ID} initialized`)

  const extractTodos = async (sessionId: string): Promise<Array<Todo>> => {
    const todosRaw = await client.session.todo({ path: { id: sessionId } });
    return (todosRaw.data || []).map((todo) => ({
      content: todo.content as string,
      status: todo.status as "pending" | "in_progress" | "completed" | "cancelled",
    }))
  }

  return {
    event: async ({ event }) => {
      const isSessionIdle = event.type === "session.idle" && event.properties.sessionID
      if (!isSessionIdle) return

      const remainingTodos = (await extractTodos(event.properties.sessionID)).filter((todo) => ["pending", "in_progress"].includes(todo.status));
      if (!remainingTodos.length) {
        await log(client, "info", "No remaining todos — clearing cancellation state.")
        return
      }


      setTimeout(async () => {
        const shouldFollowUp = readState(event.properties.sessionID, (state) => {
          const lastCancelledAt = state[SESSION_FIELDS.cancelledAt] ? new Date(state[SESSION_FIELDS.cancelledAt] as string) : null
          const lastMessageSentAt = state[SESSION_FIELDS.lastMessageSentAt] ? new Date(state[SESSION_FIELDS.lastMessageSentAt] as string) : null
          const now = new Date()

          if (!lastCancelledAt) return true

          if (!lastMessageSentAt) return true

          /**
           * idle after cancellation -> no resume
           * idle after message && no cancellation after message -> resume
           */

          const noCancellationAfterMessage = lastCancelledAt < lastMessageSentAt
          return noCancellationAfterMessage
        })

        if (!shouldFollowUp) {
          await log(client, "info", "Session was cancelled after last message — skipping followup.")
          return
        }

        await sendMessage({
          client,
          sessionId: event.properties.sessionID,
          message: buildTodoContinuationMessage(remainingTodos),
        })

        updateState(event.properties.sessionID, (s) => ({ ...s, todoFollowupSentAt: (new Date()).toISOString() }))
      }, 1000)
    },

    dispose: async () => { await log(client, "info", `${PLUGIN_ID} disposed`) },
  }
}
