import { Plugin } from '@opencode-ai/plugin'
import { log } from './helpers/logger'
import { sendMessage } from './helpers/session-helpers'
import { SessionStorage, SESSION_FIELDS } from './helpers/kv-store'
import { getSessionAgent } from './helpers/agent-steps'
import { harnessConfig } from './config/harness.config'

const PLUGIN_ID = 'todo-enforcer'

/** Consecutive technical errors tolerated before the todo follow-up loop is broken for a session. */
const DEFAULT_MAX_FOLLOWUP_ERRORS = 3

/**
 * Reads the 'todo-enforcer' section from .opencode/plugins/config/harness.config.ts
 * (modular eslint-style config). Falls back to the default when the section is
 * absent, keeping the loop-breaking behavior identical.
 */
function loadTodoEnforcerConfig(): { maxFollowUpErrors: number } {
  const section = harnessConfig.plugins['todo-enforcer']
  return { maxFollowUpErrors: section?.maxConsecutiveErrors ?? DEFAULT_MAX_FOLLOWUP_ERRORS }
}

type Todo = {
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

const AGENTS_REQUIRED_TO_START_WITH_TODOS = new Set([
  'rug',
])

const TODO_TOOL_NAME = 'todowrite'

const TODO_STATUS_SYMBOLS: Record<Todo['status'], string> = {
  pending: '[ ]',
  in_progress: '[•]',
  completed: '[✓]',
  cancelled: '[-]',
}

const todoLineToPrettyString = (todo: Todo) => `${TODO_STATUS_SYMBOLS[todo.status]} ${todo.content}`

/** Build the todo continuation message for pending/in-progress todos. */
function buildTodoContinuationMessage(todos: Array<Todo>): string {
  return `<steering priority="high" reason="incomplete todos remain" type="todo">
There are incomplete todos:
${todos.map(todo => todoLineToPrettyString(todo)).join('\n')}

Proceed with the following steps:
1. Review the pending todos.
2. Add todos for any missing tasks that need to be completed.
3. Mark completed todos as such.
4. Complete the todos that have no blockers.
5. If any todo requires user input, use the question tool to ask for it.

<reference>pending - [ ], in-progress - [•], completed - [✓], cancelled - [-]</reference>
</steering>
`
}

/** The event object received by the plugin 'event' hook, as typed by the SDK. */
type PluginEvent = Parameters<NonNullable<Awaited<ReturnType<Plugin>>['event']>>[0]['event']

/** True when the call targets the task tool for a session that enforces todos. */
const isEnforcedTaskToolCall = (input: { sessionID?: string, tool: string }): input is { sessionID: string, tool: 'task' } => {
  if (!input.sessionID) return false
  if (input.tool === TODO_TOOL_NAME) return false
  return input.tool === 'task'
}

/** True when the task call is agent/command-driven, which bypasses the todo requirement. */
const hasCommandArgument = (output: { args?: Record<string, unknown> } | undefined): boolean =>
  Boolean(output?.args?.command)

/** True only for session.idle events that carry a sessionID. */
const isSessionIdleEvent = (event: PluginEvent): event is Extract<PluginEvent, { type: 'session.idle' }> =>
  event.type === 'session.idle' && Boolean(event.properties.sessionID)

export const todoEnforcer: Plugin = async ({ client }) => {
  const { maxFollowUpErrors: TODO_FOLLOWUP_MAX_ERRORS } = loadTodoEnforcerConfig()

  const sessionStorage = new SessionStorage()
  await log(client, 'info', 'initialized', PLUGIN_ID)

  // Inner closure (calls the mocked sessionStorage/log) — spread-preserving increment.
  // Reads the count back from updateState's return value (real signature returns the updater's return value).
  // Logs the break exactly once at the threshold crossing: increments are +1, so 2→3 crosses exactly once.
  const incrementFollowUpErrorCount = (sessionId: string): void => {
    const nextState = sessionStorage.updateState(sessionId, (s: Record<string, unknown>) => {
      const nextCount = ((s[SESSION_FIELDS.todoFollowupErrorCount] as number) ?? 0) + 1
      return {
        ...s,
        [SESSION_FIELDS.todoFollowupErrorCount]: nextCount,
        // Trip marker — written in the same transition that crosses the threshold.
        ...((nextCount === TODO_FOLLOWUP_MAX_ERRORS) && { [SESSION_FIELDS.todoFollowupBrokenAt]: new Date().toISOString() }),
      }
    })
    const errorCount = (nextState as Record<string, unknown>)[SESSION_FIELDS.todoFollowupErrorCount] as number
    if (errorCount === TODO_FOLLOWUP_MAX_ERRORS) {
      void log(client, 'error', `Breaking todo follow-up loop for session ${sessionId}: ${errorCount} consecutive technical errors.`, PLUGIN_ID)
    }
  }

  const extractTodos = async (sessionId: string): Promise<Array<Todo>> => {
    const todosRaw = await client.session.todo({ path: { id: sessionId } })
    return (todosRaw.data || []).map(todo => ({
      content: todo.content as string,
      status: todo.status as 'pending' | 'in_progress' | 'completed' | 'cancelled',
    }))
  }

  /** True when the agent already called todowrite after its last message (recent enough todo usage). */
  const hasUsedTodoToolRecently = (sessionId: string): boolean =>
    sessionStorage.readState(sessionId, (state) => {
      if (!Object.hasOwn(state, SESSION_FIELDS.toolCalls)) return false
      const lastToolCall = (state[SESSION_FIELDS.toolCalls] as Record<string, string>)[TODO_TOOL_NAME]
      if (!lastToolCall) return false

      if (!Object.hasOwn(state, SESSION_FIELDS.lastMessageSentAt)) return true
      const lastMessageAt = new Date(state[SESSION_FIELDS.lastMessageSentAt] as string)
      return new Date(lastToolCall) > lastMessageAt
    }) ?? false

  // Recovery: a message created AFTER the break proves the errors stopped.
  // User messages fire this hook (documented contract + session-tracker's
  // lastMessageSentAt chain that todo-enforcer already consumes). Whether
  // steering/prompt-injected messages fire it is unknown and non-load-bearing:
  // our own follow-ups are always created BEFORE the trip, so the creation-time
  // comparison excludes them either way. Known accepted limitation: any post-break
  // message (incl. another plugin's steering) resets; if errors persist the
  // breaker re-trips after at most 3 more cycles.
  const recoverBrokenFollowUpLoop = async (sessionId: string, messageAt: number): Promise<void> => {
    const state = sessionStorage.readState(sessionId, s => s)
    if (!state) return
    const brokenAt = state[SESSION_FIELDS.todoFollowupBrokenAt] as string | undefined
    if (!brokenAt) return
    const brokenAtMs = new Date(brokenAt).getTime()
    if (Number.isNaN(brokenAtMs)) return
    if (messageAt <= brokenAtMs) return
    sessionStorage.updateState(sessionId, (s: Record<string, unknown>) => {
      const { [SESSION_FIELDS.todoFollowupBrokenAt]: _removed, ...rest } = s
      return { ...rest, [SESSION_FIELDS.todoFollowupErrorCount]: 0 }
    })
    await log(client, 'info', `Recovered todo follow-up loop for session ${sessionId} after message.`, PLUGIN_ID)
  }

  // Cancellation is owned by session-tracker (records cancelledAt) and must not count toward the break.
  // A missing/unnamed error still counts — conservative: an unclassifiable error must not loop forever.
  const handleSessionError = (event: Extract<PluginEvent, { type: 'session.error' }>): void => {
    const properties = event.properties
    if (!properties?.sessionID) return
    if (properties.error?.name === 'MessageAbortedError') return
    incrementFollowUpErrorCount(properties.sessionID)
  }

  /** Schedule the follow-up send for an idle session that still has pending todos. */
  const handleSessionIdle = async (event: Extract<PluginEvent, { type: 'session.idle' }>): Promise<void> => {
    const todos = await extractTodos(event.properties.sessionID)
    const remainingTodos = todos.filter(todo => ['pending', 'in_progress'].includes(todo.status))
    if (remainingTodos.length === 0) {
      const state = sessionStorage.readState(event.properties.sessionID, s => s) ?? {}
      const errorCount = (state[SESSION_FIELDS.todoFollowupErrorCount] as number) ?? 0
      if (errorCount > 0 || Object.hasOwn(state, SESSION_FIELDS.todoFollowupBrokenAt)) {
        sessionStorage.updateState(event.properties.sessionID, (s: Record<string, unknown>) => {
          const { [SESSION_FIELDS.todoFollowupBrokenAt]: _removed, ...rest } = s
          return { ...rest, [SESSION_FIELDS.todoFollowupErrorCount]: 0 }
        })
      }
      await log(client, 'info', 'No remaining todos — clearing follow-up error state.', PLUGIN_ID)
      return
    }

    setTimeout(async () => {
      try {
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
          await log(client, 'info', 'Session was cancelled after last message — skipping followup.', PLUGIN_ID)
          return
        }

        // Break the loop when the session has repeatedly thrown technical errors.
        // Silent skip — the break was logged exactly once at the threshold crossing.
        // >= keeps a persisted count already above the threshold broken.
        const state = sessionStorage.readState(event.properties.sessionID, s => s) ?? {}
        const errorCount = (state[SESSION_FIELDS.todoFollowupErrorCount] as number) ?? 0
        if (errorCount >= TODO_FOLLOWUP_MAX_ERRORS) {
          // Mark that the breaker triggered and prevented this follow-up.
          // Backfills legacy persisted counts that predate todoFollowupBrokenAt.
          if (!Object.hasOwn(state, SESSION_FIELDS.todoFollowupBrokenAt)) {
            sessionStorage.updateState(event.properties.sessionID, s => ({
              ...s,
              [SESSION_FIELDS.todoFollowupBrokenAt]: new Date().toISOString(),
            }))
          }
          return
        }

        await sendMessage({
          client,
          sessionId: event.properties.sessionID,
          message: buildTodoContinuationMessage(remainingTodos),
        })

        sessionStorage.updateState(event.properties.sessionID, s => ({ ...s, todoFollowupSentAt: (new Date()).toISOString() }))
      }
      catch (error) {
        incrementFollowUpErrorCount(event.properties.sessionID)
        await log(client, 'error', `Todo follow-up failed: ${error}`, PLUGIN_ID)
      }
    }, 500)
  }

  return {
    'tool.execute.before': async (input, output) => {
      if (!isEnforcedTaskToolCall(input)) return

      // Agent-based/command-driven tasks bypass todo requirement — they are internal routing calls
      if (hasCommandArgument(output)) {
        await log(client, 'info', `task tool called with command on session ${input.sessionID} — skipping enforcement`, PLUGIN_ID)
        return
      }

      await log(client, 'info', `enforcing todo requirement for task tool on session ${input.sessionID}`, PLUGIN_ID)

      const currentAgent = await getSessionAgent(client, input.sessionID)

      if (!AGENTS_REQUIRED_TO_START_WITH_TODOS.has(currentAgent)) return

      if (hasUsedTodoToolRecently(input.sessionID)) return

      const sampleTodo = [{
        content: `#plan express the plan in todos; assignee: @${currentAgent}`,
        status: 'pending',
        priority: 'high',
        id: '1',
      }]

      throw new Error(`Error calling ${input.tool}. All tools are suspended until \`${TODO_TOOL_NAME}\` is called with updated todo list. Sample todo list: ${JSON.stringify(sampleTodo)}`)
    },
    'chat.message': async (input, output) => {
      const sessionId = input?.sessionID
      if (!sessionId) return
      const created = output?.message?.time?.created
      // Fall back to dispatch time if the message creation timestamp is absent
      // (graceful degradation; the hook fires at message receipt).
      const messageAt = typeof created === 'number' ? created : Date.now()
      await recoverBrokenFollowUpLoop(sessionId, messageAt)
    },
    'event': async ({ event }) => {
      if (event.type === 'session.error') {
        handleSessionError(event)
        return
      }
      if (!isSessionIdleEvent(event)) return
      await handleSessionIdle(event)
    },

    'dispose': async () => { await log(client, 'info', 'disposed', PLUGIN_ID) },
  }
}
