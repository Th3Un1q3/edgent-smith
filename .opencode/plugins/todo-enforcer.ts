
import { Plugin } from "@opencode-ai/plugin"
import { log } from "./helpers/logger"
import { sendMessage } from "./helpers/session-helpers"
import { SessionStorage, SESSION_FIELDS } from "./helpers/kv-store"


const PLUGIN_ID = "todo-enforcer"

type Todo = {
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
}

const AGENTS_REQUIRED_TO_START_WITH_TODOS = new Set([
  "rug"
])

const TODO_TOOL_NAME = "todowrite"

const TODO_STATUS_SYMBOLS: Record<Todo["status"], string> = {
  pending: "[ ]",
  in_progress: "[•]",
  completed: "[✓]",
  cancelled: "[-]",
}

const todoLineToPrettyString = (todo: Todo) => `${TODO_STATUS_SYMBOLS[todo.status]} ${todo.content}`

/** Build the todo continuation message for pending/in-progress todos. */
function buildTodoContinuationMessage(todos: Array<Todo>): string {
  return `There are incomplete todos:
${todos.map((todo) => todoLineToPrettyString(todo)).join("\n")}

Proceed with the following steps:
1. Review the pending todos.
2. Add todos for any missing tasks that need to be completed.
3. Mark completed todos as such.
4. Complete the todos that have no blockers.
5. If any todo requires user input, use the question tool to ask for it.

<reference>pending - [ ], in-progress - [•], completed - [✓], cancelled - [-]</reference>
`
}

export const todoEnforcer: Plugin = async ({ client }) => {
  const sessionStorage = new SessionStorage() // TODO: implement dependency injection
  await log(client, "info", `${PLUGIN_ID} initialized`)

  const extractTodos = async (sessionId: string): Promise<Array<Todo>> => {
    const todosRaw = await client.session.todo({ path: { id: sessionId } });
    return (todosRaw.data || []).map((todo) => ({
      content: todo.content as string,
      status: todo.status as "pending" | "in_progress" | "completed" | "cancelled",
    }))
  }

  return {
    "tool.execute.before": async (input, output) => {
      if (!input.sessionID) return
      if (input.tool === TODO_TOOL_NAME) return

      if (input.tool === "task" && output.args && output.args.command && output.args.command === "rug-brief") {
        await log(client, "info", `[todo-enforcer] task tool called for session ${input.sessionID} — ${JSON.stringify(output.args)}`)
        return
      }

      const currentAgent = ((await client.session.get({ path: { id: input.sessionID } }) as unknown as { data?: Record<string, string> })).data?.agent as string

      if (!AGENTS_REQUIRED_TO_START_WITH_TODOS.has(currentAgent)) return

      const hasUsedTodos = sessionStorage.readState(input.sessionID, (state) => {
        if (!Object.hasOwn(state, SESSION_FIELDS.toolCalls)) return false

        const lastMessageAt = Object.hasOwn(state, SESSION_FIELDS.lastMessageSentAt) && new Date(state[SESSION_FIELDS.lastMessageSentAt] as string)

        const lastToolCall = (state[SESSION_FIELDS.toolCalls] as Record<string, string>)[TODO_TOOL_NAME]
        if (!lastToolCall) return false

        return lastMessageAt && new Date(lastToolCall) > lastMessageAt
      })

      if (hasUsedTodos) return

      const sampleTodo = [{
        content: `#plan express the plan in todos; assignee: @${currentAgent}`,
        status: "pending",
        priority: "high",
        id: "1"
      }]

      throw new Error(`Error calling ${input.tool}. All tools are suspended until \`${TODO_TOOL_NAME}\` is called with updated todo list. Sample todo list: ${JSON.stringify(sampleTodo)}`);
    },
    event: async ({ event }) => {
      const isSessionIdle = event.type === "session.idle" && event.properties.sessionID
      if (!isSessionIdle) return

      const todos = await extractTodos(event.properties.sessionID)
      const remainingTodos = todos.filter((todo) => ["pending", "in_progress"].includes(todo.status));
      if (remainingTodos.length === 0) {
        await log(client, "info", "No remaining todos — clearing cancellation state.")
        return
      }


      setTimeout(async () => {
        const shouldFollowUp = sessionStorage.readState(event.properties.sessionID, (state) => {
          const lastCancelledAt = Object.hasOwn(state, SESSION_FIELDS.cancelledAt) && new Date(state[SESSION_FIELDS.cancelledAt] as string)
          const lastMessageSentAt = Object.hasOwn(state, SESSION_FIELDS.lastMessageSentAt) && new Date(state[SESSION_FIELDS.lastMessageSentAt] as string)

          if (!lastCancelledAt || !lastMessageSentAt) return true

          /**
          idle after cancellation -> no resume
          idle after message && no cancellation after message -> resume
          */

          const isNoCancellationAfterMessage = lastCancelledAt < lastMessageSentAt
          return isNoCancellationAfterMessage
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

        sessionStorage.updateState(event.properties.sessionID, (s) => ({ ...s, todoFollowupSentAt: (new Date()).toISOString() }))
      }, 500)
    },

    dispose: async () => { await log(client, "info", `${PLUGIN_ID} disposed`) },
  }
}
