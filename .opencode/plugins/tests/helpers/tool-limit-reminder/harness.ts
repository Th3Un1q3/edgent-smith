import '@tests/helpers/tool-limit-reminder/mocks'

import { Effect, Exit, Fiber, Logger, Queue, Stream } from 'effect'

import type { Context } from '@opencode/plugin/effect/plugin'

/**
 * Shared harness for the tool-limit-reminder suites.
 *
 * tool-limit-reminder — OpenCode v2 Effect plugin (three-tier tool-call gate).
 *
 * Pinned contract (storage is keyed per session):
 *   review/<sessionID> -> { problems: ProblemStatement[] }   // durable
 *   metadata.needsReview on the session                      // durable, native
 * Counters, the budget cache and the prompt-tag guard are in-memory and per-turn.
 *
 * Gate semantics (T = limits[agent] ?? floor(steps * factor), P = padding). The
 * pre-increment attempt count in `execute.before` drives all three tiers:
 *   current === T         -> reminder synthetic
 *   T < current <= T + P  -> needsReview + one deduped problem + review synthetic
 *   current > T + P       -> `execute.before` fails with Tool.Error(BLOCK_TEXT)
 * `callsCompleted` (`execute.after`, status completed) is the problem `actual`.
 */

export const REMINDER_TEXT = 'tool call limit reached'
export const REVIEW_TEXT = 'tool call limit exceeded'

import { shell, tlrConfig } from '@tests/helpers/tool-limit-reminder/state'

import plugin from '@plugins/tool-limit-reminder'

export type Event = { type: string } & Record<string, unknown>

type Hook = (event: unknown) => Effect.Effect<unknown, unknown>

export interface SessionRecord {
  agent?: string
  parentID?: string
  metadata?: Record<string, unknown>
}

export interface Problem {
  source: string
  thresholdName: string
  expectedMax: number
  actual: number
  message: string
}

export interface SyntheticMessage {
  sessionID: string
  text: string
  resume?: boolean
  delivery?: string
}

export interface Harness {
  context: Context
  storage: Map<string, unknown>
  synthetics: SyntheticMessage[]
  sessions: Map<string, SessionRecord>
  sessionUpdates: Array<{ sessionID: string, metadata?: Record<string, unknown> }>
  agentGets: string[]
  agents: Map<string, 'fail' | { steps?: number }>
  agentList: unknown[]
  logs: string[]
  ready: () => Promise<void>
  emit: (event: Event) => Promise<void>
  before: (event: unknown) => Promise<Exit.Exit<unknown, unknown>>
  after: (event: unknown) => Promise<Exit.Exit<unknown, unknown>>
  prompt: (event: { sessionID: string, prompt: { text: string } }) => Promise<Exit.Exit<unknown, unknown>>
}

const REVIEW_PREFIX = 'review/'
const NOOP: Event = { type: 'noop' }

export const reviewKey = (sessionID: string): string => REVIEW_PREFIX + sessionID

export const idle = (sessionID: string): Event => ({ type: 'session.idle', data: { sessionID } })

export const statusIdle = (sessionID: string): Event => ({
  type: 'session.status',
  data: { sessionID, status: { type: 'idle' } },
})

export const toolEvent = (tool: string, sessionID = 'ses_1', agent = 'build'): Record<string, unknown> => ({
  tool,
  sessionID,
  agent,
  messageID: 'msg_1',
  id: 'call_1',
  input: {},
})

export const afterEvent = (status: string, tool?: string, sessionID?: string, agent?: string): Record<string, unknown> => ({
  ...toolEvent(tool ?? 'read', sessionID, agent),
  status,
})

// One `read` attempt through the gate. Keeping the `toolEvent(...)` call out of
// the assertion keeps it within the maximum call-nesting depth.
export const attempt = (h: Harness, sessionID = 'ses_1'): Promise<Exit.Exit<unknown, unknown>> =>
  h.before(toolEvent('read', sessionID))

// Sequential attempts through the gate; order matters because each one advances the call count.
export const attemptTimes = async (h: Harness, times: number, sessionID = 'ses_1'): Promise<boolean[]> => {
  const results: boolean[] = []
  for (let index = 0; index < times; index += 1) {
    results.push(Exit.isSuccess(await attempt(h, sessionID)))
  }
  return results
}

export const makeHarness = (): Harness => {
  const storage = new Map<string, unknown>()
  const synthetics: Harness['synthetics'] = []
  const logs: string[] = []
  const sessions = new Map<string, SessionRecord>([['ses_1', { agent: 'build', metadata: {} }]])
  const sessionUpdates: Harness['sessionUpdates'] = []
  const agentGets: string[] = []
  const agents = new Map<string, 'fail' | { steps?: number }>([['build', { steps: 5 }]])
  const agentList: unknown[] = []
  const hooks: Record<string, Hook> = {}

  // One queue per `event.subscribe()` call (the plugin subscribes twice: idle
  // and agent-selected). Capacity 0 makes every offer a rendezvous, so `emit`
  // resolves only after the handler for that element has run.
  const queues = [Effect.runSync(Queue.bounded<Event>(0)), Effect.runSync(Queue.bounded<Event>(0))]
  let subscriptions = 0

  const offer = async (queue: Queue.Queue<Event>, event: Event): Promise<void> => {
    await Effect.runPromise(Queue.offer(queue, event))
  }

  const h: Harness = {
    storage,
    synthetics,
    sessions,
    sessionUpdates,
    agentGets,
    agents,
    agentList,
    logs,
    ready: async () => {
      await Promise.all(queues.map(async queue => offer(queue, NOOP)))
    },
    emit: async (event) => {
      for (const queue of queues) {
        await offer(queue, event)
        await offer(queue, NOOP)
      }
    },
    before: async event => Effect.runPromiseExit(hooks['tool:execute.before'](event)),
    after: async event => Effect.runPromiseExit(hooks['tool:execute.after'](event)),
    prompt: async event => Effect.runPromiseExit(hooks['session:prompt'](event)),
    context: {
      options: {},
      location: { directory: '/workspace' },
      agent: {
        list: () => Effect.succeed({ data: agentList }),
        get: (input: { agentID: string }) => {
          agentGets.push(input.agentID)

          const entry = agents.get(input.agentID)
          return entry === undefined || entry === 'fail' ? Effect.fail(new Error('agent not found: ' + input.agentID)) : Effect.succeed({ data: { id: input.agentID, steps: entry.steps } })
        },
      },
      tool: {
        hook: (name: string, callback: Hook) => {
          hooks['tool:' + name] = callback
          return Effect.succeed({ dispose: Effect.void })
        },
      },
      event: {
        subscribe: () => {
          const queue = (queues[subscriptions] ??= Effect.runSync(Queue.bounded<Event>(0)))

          subscriptions += 1
          return Stream.fromQueue(queue)
        },
      },
      session: {
        get: (input: { sessionID: string }) => {
          const session = sessions.get(input.sessionID)
          return session === undefined
            ? Effect.fail(new Error('session not found: ' + input.sessionID))
            : Effect.succeed(session)
        },
        update: (input: { sessionID: string, metadata?: Record<string, unknown> }) => Effect.sync(() => {
          sessionUpdates.push({ sessionID: input.sessionID, metadata: input.metadata })

          const session = sessions.get(input.sessionID)
          if (session !== undefined && input.metadata !== undefined) session.metadata = input.metadata
        }),
        synthetic: (input: Harness['synthetics'][number]) => {
          synthetics.push(input)
          return Effect.succeed({})
        },
        hook: (name: string, callback: Hook) => {
          hooks['session:' + name] = callback
          return Effect.succeed({ dispose: Effect.void })
        },
      },
      storage: {
        get: (key: string) => Effect.succeed(storage.get(key)),
        set: (key: string, value: unknown) => Effect.sync(() => { storage.set(key, value) }),
        remove: (key: string) => Effect.sync(() => { storage.delete(key) }),
        // Page size 1 forces the replay loop to drain via `StorageScanResult.next`.
        scan: ({ prefix, after, limit = 1 }: { prefix: string, after?: string, limit?: number }) => {
          const matching = [...storage]
            .filter(([key]) => key.startsWith(prefix))
            .filter(([key]) => after === undefined || key > after)
            .sort(([a], [b]) => (a < b ? -1 : (a > b ? 1 : 0)))
          const page = matching.slice(0, limit)
          const next = nextOf(matching, page)
          return Effect.succeed({
            entries: page.map(([key, value]) => ({ key, value })),
            ...(next !== undefined && { next }),
          })
        },
      },
    } as unknown as Context }

  return h
}

// The cursor a scan reports: the last key of the page, only when more entries follow.
const nextOf = (matching: Array<[string, unknown]>, page: Array<[string, unknown]>): string | undefined =>
  matching.length > page.length ? page.at(-1)?.[0] : undefined

const fibers: Array<Fiber.Fiber<never, never>> = []

export const register = async (h: Harness): Promise<void> => {
  // Captures the plugin's Effect logs so activation is observable in tests.
  const collectLogger = Logger.make<unknown, void>(({ message }) => {
    h.logs.push(Array.isArray(message) ? message.map(String).join(' ') : String(message))
  })
  const program = Effect.scoped(Effect.flatMap(plugin.effect(h.context), () => Effect.never))
  const fiber = Effect.runFork(Effect.withLogger(program, collectLogger))

  fibers.push(fiber)
  await h.ready()
}

export const resetScenario = (): void => {
  tlrConfig.present = true
  tlrConfig.factor = 0.8
  tlrConfig.padding = 2
  tlrConfig.limits = {}
  tlrConfig.ignoreTools = ['signal_send']
  tlrConfig.review = { export: true, command: 'just agent_utils/export-opencode-session', writeMarkdown: true }
  shell.exitCode = 0
  shell.commands = []
}

export const stopPluginFibers = async (): Promise<void> => {
  await Promise.all(fibers.map(fiber => Effect.runPromise(Fiber.interrupt(fiber))))
  fibers.length = 0
}

export const storedProblems = (h: Harness, sessionID: string): Problem[] =>
  (h.storage.get(reviewKey(sessionID)) as { problems?: Problem[] } | undefined)?.problems ?? []

export const reminderSynthetics = (h: Harness): Harness['synthetics'] =>
  h.synthetics.filter(synthetic => synthetic.text.includes(REMINDER_TEXT))

export const reviewSynthetics = (h: Harness): Harness['synthetics'] =>
  h.synthetics.filter(synthetic => synthetic.text.includes(REVIEW_TEXT))

export const storedReview = (actual: number): { problems: Problem[] } => ({
  problems: [{
    source: 'agent',
    thresholdName: 'build',
    expectedMax: 4,
    actual,
    message: 'pre-existing problem',
  }],
})

export { shell, tlrConfig } from '@tests/helpers/tool-limit-reminder/state'
