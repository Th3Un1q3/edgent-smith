import { Effect, Exit, Fiber, Logger, Queue, Stream } from 'effect'

import type { Context } from '@opencode/plugin/effect/plugin'

import plugin from '@plugins/goal-continuation'

/**
 * Shared harness for the goal-continuation plugin tests.
 *
 * The `goal` tool writes and clears the per-session record while
 * `session.idle` claims a nudge and `execute.before` denies non-allowlisted
 * tools for an enforced, armed, non-child session.
 *
 * Contract pinned by the tests using this harness (storage is keyed per session):
 *   goal/<sessionID> -> { text: string, nudges: number }   // absent key means done
 *
 * The harness mock (`vi.mock('@plugins/config/harness.config', ...)`) and the
 * mutable `goalConfig` object live in each test file, so `plugin` reads the
 * scenario-specific config at registration time.
 */

export const ALLOWLIST = ['question', 'read', 'glob', 'grep', 'skill']

type Event = { type: string } & Record<string, unknown>

interface RegisteredTool {
  name: string
  execute: (input: unknown, context: unknown) => Effect.Effect<unknown, unknown>
}

interface SessionInfo {
  agent: string
  parentID?: string
}

export type PermissionRule = { action: string, resource: string, effect: string }

type AgentInfo = { id: string, permissions: PermissionRule[] }

type Hook = (event: unknown) => Effect.Effect<unknown, unknown>

export interface Harness {
  context: Context
  storage: Map<string, unknown>
  synthetics: Array<{ sessionID: string, text: string, resume?: boolean, delivery?: string }>
  tools: Map<string, RegisteredTool>
  session: SessionInfo
  agentList: AgentInfo[]
  logs: string[]
  syntheticFails: boolean
  ready: () => Promise<void>
  arm: (sessionID: string) => Promise<void>
  emit: (event: Event) => Promise<void>
  before: (event: unknown) => Promise<Exit.Exit<unknown, unknown>>
  runTool: (name: string, input: unknown, sessionID?: string, agent?: string) => Promise<Exit.Exit<unknown, unknown>>
}

export const GOAL_KEY = (sessionID: string): string => 'goal/' + sessionID
export const GATE_KEY = (sessionID: string): string => 'goal-gate/' + sessionID
const NOOP: Event = { type: 'noop' }

export const idle = (sessionID: string): Event => ({ type: 'session.idle', data: { sessionID } })

export const toolEvent = (tool: string, sessionID = 'ses_1', agent = 'build'): Record<string, unknown> => ({
  tool,
  sessionID,
  agent,
  messageID: 'msg_1',
  id: 'call_1',
  input: {},
})

const toolContext = (sessionID: string, agent: string): unknown => ({
  sessionID,
  agent,
  messageID: 'msg_1',
  id: 'call_1',
  directory: '/workspace',
  worktree: '/workspace',
})

export const makeHarness = (sharedStorage?: Map<string, unknown>): Harness => {
  const storage = sharedStorage ?? new Map<string, unknown>()
  const synthetics: Harness['synthetics'] = []
  const logs: string[] = []
  const tools = new Map<string, RegisteredTool>()
  const hooks: Record<string, Hook> = {}
  const queue = Effect.runSync(Queue.bounded<Event>(0))

  const emitEvent = async (event: Event): Promise<void> => {
    await Effect.runPromise(Queue.offer(queue, event))
    // Rendezvous: the noop offer resolves only when the stream pulls again,
    // which happens after the previous element's handler has completed.
    await Effect.runPromise(Queue.offer(queue, NOOP))
  }

  const h: Harness = {
    context: undefined as unknown as Context,
    storage,
    synthetics,
    tools,
    session: { agent: 'build' },
    agentList: [{ id: 'build', permissions: [
      { action: '*', resource: '*', effect: 'deny' },
      { action: 'goal', resource: '*', effect: 'allow' },
    ] }],
    logs,
    syntheticFails: false,
    ready: async () => { await emitEvent(NOOP) },
    arm: async (sessionID) => { await Effect.runPromise(hooks['session:prompt']({ sessionID })) },
    emit: emitEvent,
    before: async event => Effect.runPromiseExit(hooks['tool:execute.before'](event)),
    runTool: async (name, input, sessionID = 'ses_1', agent = 'rug') => {
      const tool = tools.get(name)
      if (tool === undefined) throw new Error('tool not registered: ' + name)
      return Effect.runPromiseExit(tool.execute(input, toolContext(sessionID, agent)))
    },
  }

  h.context = {
    options: {},
    location: { directory: '/workspace' },
    agent: {
      list: () => Effect.succeed({ data: h.agentList }),
      get: () => Effect.succeed({ data: { id: 'build', permissions: [] } }),
    },
    tool: {
      transform: (callback: (editor: { add: (tool: RegisteredTool) => void }) => void) => {
        callback({
          add: (tool) => {
            tools.set(tool.name, tool)
          },
        })
        return Effect.succeed({ dispose: Effect.void })
      },
      hook: (name: string, callback: Hook) => {
        hooks['tool:' + name] = callback
        return Effect.succeed({ dispose: Effect.void })
      },
    },
    event: {
      subscribe: () => Stream.fromQueue(queue),
    },
    session: {
      get: () => Effect.succeed(h.session),
      synthetic: (input: Harness['synthetics'][number]) => {
        if (h.syntheticFails) return Effect.fail(new Error('synthetic failed'))
        synthetics.push(input)
        return Effect.succeed({})
      },
      prompt: () => Effect.void,
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
      scan: (options: { prefix: string, after?: string, limit?: number }) => {
        const matching = [...storage]
          .filter(([key]) => key.startsWith(options.prefix))
          .filter(([key]) => options.after === undefined || key > options.after)
          .sort(([a], [b]) => (a < b ? -1 : (a > b ? 1 : 0)))
        const limit = options.limit ?? 1
        const page = matching.slice(0, limit)
        const last = page.at(-1)
        const next = last !== undefined && matching.length > limit ? last[0] : undefined
        return Effect.succeed({
          entries: page.map(([key, value]) => ({ key, value })),
          ...(next !== undefined && { next }),
        })
      },
    },
  } as unknown as Context

  return h
}

export const fibers: Array<Fiber.Fiber<never, never>> = []

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
