import { Deferred, Effect, Exit, Fiber, Logger, Queue, Stream } from 'effect'

import type { Context } from '@opencode/plugin/effect/plugin'

import { createStateMachinePlugin } from '@plugins/state-machine'
import { loadStateMachineLibrary } from '@plugins/state-machine/core/machine'

import type { CallbackPayload, InjectedMemories } from '@plugins/state-machine/core/machine'

/**
 * Harness for the state-machine plugin tests.
 *
 * The plugin registers one tool and subscribes to four event streams (session
 * start, inbox, idle and interruption), so a fake session context has to fan an
 * event out to every subscription and
 * wait for each handler to finish before the assertion runs. Each subscription
 * gets its own zero-capacity queue: offering resolves only when a consumer
 * takes the element, and the trailing noop resolves only when that consumer
 * pulls again, which happens after the handler completed.
 *
 * `ready()` releases when the last subscription starts pulling, which is after
 * the library load, the configuration read, the tool registration and every
 * subscription.
 */

const SUBSCRIPTIONS = 4

type Event = { type: string } & Record<string, unknown>

interface RegisteredTool {
  name: string
  description?: string
  input?: unknown
  options?: { codemode?: boolean }
  execute: (input: unknown, context: unknown) => Effect.Effect<unknown, unknown>
}

// Mirrors SessionSyntheticInput in @opencode/client dist/effect/api/api.d.ts.
export interface SyntheticMessage {
  sessionID: string
  text: string
  description?: string
  resume?: boolean
}

export interface Harness {
  context: Context
  synthetics: SyntheticMessage[]
  storageWrites: Array<{ key: string, value: unknown }>
  failStorageWrites: boolean
  failStorageReads: boolean
  sessionParents: Map<string, string>
  sessionAgents: Map<string, string>
  createdSessions: string[]
  failSessionCreate: boolean
  failSkillInjection: boolean
  failMemories: boolean
  tools: Map<string, RegisteredTool>
  toolHooks: Map<string, (payload: unknown) => Effect.Effect<void>>
  logs: string[]
  shellCommands: string[]
  shellResult: CallbackPayload
  injectedSkills: string[]
  memories: InjectedMemories
  ready: () => Promise<void>
  emit: (event: Event) => Promise<void>
  emitUserMessage: (sessionID: string, itemType: string, text: string) => Promise<void>
  runTool: (input: unknown, sessionID?: string, agent?: string) => Promise<Exit.Exit<unknown, unknown>>
}

const NOOP: Event = { type: 'noop' }

export const sessionCreated = (sessionID: string, agent?: string): Event => ({
  type: 'session.created',
  data: agent === undefined ? { sessionID } : { sessionID, agent },
})

export const sessionIdle = (sessionID: string): Event => ({ type: 'session.idle', data: { sessionID } })

export const sessionInterrupted = (sessionID: string, reason: string): Event => ({
  type: 'session.execution.interrupted',
  data: { sessionID, reason },
})

const toolContext = (sessionID: string, agent: string): unknown => ({
  sessionID,
  agent,
  messageID: 'msg_1',
  id: 'call_1',
  directory: '/workspace',
  worktree: '/workspace',
})

export const makeHarness = (): Harness => {
  const queues: Array<Queue.Queue<Event>> = []
  const synthetics: Harness['synthetics'] = []
  const storageWrites: Harness['storageWrites'] = []
  const logs: string[] = []
  const tools = new Map<string, RegisteredTool>()
  const toolHooks = new Map<string, (payload: unknown) => Effect.Effect<void>>()
  const registered = Effect.runSync(Deferred.make<void>())

  const subscribed = (): Stream.Stream<Event> => {
    const queue = Effect.runSync(Queue.bounded<Event>(0))
    queues.push(queue)
    const started = queues.length === SUBSCRIPTIONS ? Deferred.succeed(registered, undefined) : Effect.void
    return Stream.fromEffect(started).pipe(Stream.drain, Stream.concat(Stream.fromQueue(queue)))
  }

  const emit = async (event: Event): Promise<void> => {
    for (const queue of queues) {
      await Effect.runPromise(Queue.offer(queue, event))
      await Effect.runPromise(Queue.offer(queue, NOOP))
    }
  }

  const latest = (key: string): unknown => {
    for (let index = storageWrites.length - 1; index >= 0; index -= 1) {
      const write = storageWrites[index]
      if (write !== undefined && write.key === key) return write.value
    }
    return undefined
  }

  const h: Harness = {
    synthetics,
    storageWrites,
    failStorageWrites: false,
    failStorageReads: false,
    sessionParents: new Map<string, string>(),
    sessionAgents: new Map<string, string>(),
    createdSessions: [],
    failSessionCreate: false,
    failSkillInjection: false,
    failMemories: false,
    tools,
    toolHooks,
    logs,
    shellCommands: [],
    shellResult: { ok: true, exitCode: 0, output: '' },
    injectedSkills: [],
    memories: { full: [], index: [] },
    ready: async () => { await Effect.runPromise(Deferred.await(registered)) },
    emit,
    emitUserMessage: (sessionID, itemType, text) => emit({
      type: 'session.inbox.enqueued',
      data: { sessionID, item: { type: itemType, payload: { text } } },
    }),
    runTool: async (input, sessionID = 'ses_1', agent = 'rug') => {
      const tool = tools.get('signal_send')
      if (tool === undefined) throw new Error('signal_send is not registered')
      const collect = Logger.make<unknown, void>(({ message }) => {
        const text = Array.isArray(message) ? message.map(String).join(' ') : String(message)
        logs.push(text)
      })
      const run = tool.execute(input, toolContext(sessionID, agent))
      const exit = await Effect.runPromiseExit(Effect.withLogger(run, collect))
      return exit
    },
    context: {
      options: {},
      location: { directory: '/workspace' },
      agent: {
        list: () => Effect.succeed({ data: [] }),
        get: () => Effect.succeed({ data: { id: 'fixture-agent', permissions: [] } }),
      },
      tool: {
        transform: (callback: (editor: { add: (tool: RegisteredTool) => void }) => void) => {
          const add = (tool: RegisteredTool): void => {
            tools.set(tool.name, tool)
          }
          callback({ add })
          return Effect.succeed({ dispose: Effect.void })
        },
        hook: (name: string, callback: (payload: unknown) => Effect.Effect<void>) => {
          toolHooks.set(name, callback)
          return Effect.succeed({ dispose: Effect.void })
        },
      },
      event: {
        subscribe: subscribed,
      },
      session: {
        create: () => h.failSessionCreate
          ? Effect.fail(new Error('create refused'))
          : Effect.sync(() => {
              const id = 'ses_child_' + String(h.createdSessions.length + 1)
              h.createdSessions.push(id)
              return { id }
            }),
        get: (input?: { sessionID?: string }) => {
          const parent = input?.sessionID === undefined ? undefined : h.sessionParents.get(input.sessionID)
          const agent = input?.sessionID === undefined ? 'rug' : (h.sessionAgents.get(input.sessionID) ?? 'rug')
          return Effect.succeed(parent === undefined
            ? { agent }
            : { agent, parentID: parent })
        },
        synthetic: (input: SyntheticMessage) => Effect.sync(() => { synthetics.push(input) }),
        prompt: () => Effect.void,
        hook: () => Effect.succeed({ dispose: Effect.void }),
      },
      storage: {
        get: (key: string) => h.failStorageReads
          ? Effect.fail(new Error('storage read refused'))
          : Effect.sync(() => latest(key)),
        set: (key: string, value: unknown) => h.failStorageWrites
          ? Effect.fail(new Error('storage write refused'))
          : Effect.sync(() => { storageWrites.push({ key, value }) }),
        remove: (key: string) => Effect.sync(() => {
          const index = storageWrites.findIndex(write => write.key === key)
          if (index !== -1) storageWrites.splice(index, 1)
        }),
        scan: () => Effect.succeed({ entries: [] }),
      },
    } as unknown as Context,
  }

  return h
}

export const fibers: Array<Fiber.Fiber<never, never>> = []

export const start = (h: Harness): Fiber.Fiber<never, never> => {
  const collectLogger = Logger.make<unknown, void>(({ message }) => {
    h.logs.push(Array.isArray(message) ? message.map(String).join(' ') : String(message))
  })
  const plugin = createStateMachinePlugin(loadStateMachineLibrary, {
    runShell: (command) => {
      h.shellCommands.push(command)
      return Effect.succeed(h.shellResult)
    },
    injectSkill: (_sessionId, name) => h.failSkillInjection
      ? Effect.fail(new Error('skill refused'))
      : Effect.sync(() => {
          h.injectedSkills.push(name)
        }),
    loadMemories: () => h.failMemories ? Effect.fail(new Error('memory refused')) : Effect.succeed(h.memories),
  })
  const program = Effect.scoped(Effect.flatMap(plugin.effect(h.context), () => Effect.never))
  const fiber = Effect.runFork(Effect.withLogger(program, collectLogger))

  fibers.push(fiber)
  return fiber
}

export const register = async (h: Harness): Promise<void> => {
  start(h)
  await h.ready()
}
