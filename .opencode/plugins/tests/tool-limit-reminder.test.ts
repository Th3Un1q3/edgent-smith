import { Cause, Effect, Exit, Fiber, Logger, Option, Queue, Stream } from 'effect'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

import { Tool } from '@opencode/schema/tool'

/**
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

const BLOCK_TEXT
  = 'Error calling tools. Reason: tools are blocked. STOP YOUR WORK. DON\'T change, read, write files, execute commands in this session. Follow the instructions in the previous message to summarize your work and stop.'

const REMINDER_TEXT = 'tool call limit reached'
const REVIEW_TEXT = 'tool call limit exceeded'

// Config is read at plugin-registration time; mutate this hoisted object before
// `register()` to steer the gate per scenario. The getter keeps the
// "missing section" fallback case reachable from a mocked module.
const tlrConfig = vi.hoisted(() => ({
  present: true,
  factor: 0.8,
  padding: 2,
  limits: {} as Record<string, number>,
  ignoreTools: ['goal'],
  review: { export: true, command: 'just agent_utils/export-opencode-session', writeMarkdown: true },
}))

// The export shell. `$` is a plain function (not a `vi.fn`) so `mockReset`
// cannot strip its implementation; calls are recorded in hoisted state.
const shell = vi.hoisted(() => ({ exitCode: 0, commands: [] as string[] }))

vi.mock('@plugins/config/harness.config', () => ({
  harnessConfig: {
    plugins: {
      get 'tool-limit-reminder'() {
        return tlrConfig.present
          ? {
              factor: tlrConfig.factor,
              padding: tlrConfig.padding,
              limits: tlrConfig.limits,
              ignoreTools: tlrConfig.ignoreTools,
              review: tlrConfig.review,
            }
          : undefined
      },
    },
  },
}))

// `bun` is aliased to the repo shim (no `$`); this mock supplies the export shell.
vi.mock('bun', () => ({
  $: (strings: TemplateStringsArray) => {
    shell.commands.push(String(strings))

    const promise = Promise.resolve({ exitCode: shell.exitCode, stdout: '', stderr: '' })
    const shellPromise = promise as typeof promise & { nothrow: () => unknown, quiet: () => unknown }

    shellPromise.nothrow = () => promise
    shellPromise.quiet = () => promise
    return promise
  },
}))

// Real writes must never reach `.tmp/session-review` during tests.
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }))

import { writeFile } from 'node:fs/promises'

import plugin from '@plugins/tool-limit-reminder'

type Event = { type: string } & Record<string, unknown>

type Hook = (event: unknown) => Effect.Effect<unknown, unknown>

interface SessionRecord {
  agent?: string
  parentID?: string
  metadata?: Record<string, unknown>
}

interface Problem {
  source: string
  thresholdName: string
  expectedMax: number
  actual: number
  message: string
}

interface Harness {
  context: Context
  storage: Map<string, unknown>
  synthetics: Array<{ sessionID: string, text: string, resume?: boolean, delivery?: string }>
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

const reviewKey = (sessionID: string): string => REVIEW_PREFIX + sessionID

const idle = (sessionID: string): Event => ({ type: 'session.idle', data: { sessionID } })

const statusIdle = (sessionID: string): Event => ({
  type: 'session.status',
  data: { sessionID, status: { type: 'idle' } },
})

const toolEvent = (tool: string, sessionID = 'ses_1', agent = 'build'): Record<string, unknown> => ({
  tool,
  sessionID,
  agent,
  messageID: 'msg_1',
  id: 'call_1',
  input: {},
})

const afterEvent = (status: string, tool = 'read', sessionID = 'ses_1', agent = 'build'): Record<string, unknown> => ({
  tool,
  sessionID,
  agent,
  messageID: 'msg_1',
  id: 'call_1',
  status,
  input: {},
})

// One `read` attempt through the gate. Keeping the `toolEvent(...)` call out of
// the assertion keeps it within the maximum call-nesting depth.
const attempt = (h: Harness, sessionID = 'ses_1'): Promise<Exit.Exit<unknown, unknown>> =>
  h.before(toolEvent('read', sessionID))

const makeHarness = (): Harness => {
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
    } as unknown as Context }

  return h
}

const fibers: Array<Fiber.Fiber<never, never>> = []

const register = async (h: Harness): Promise<void> => {
  // Captures the plugin's Effect logs so activation is observable in tests.
  const collectLogger = Logger.make<unknown, void>(({ message }) => {
    h.logs.push(Array.isArray(message) ? message.map(String).join(' ') : String(message))
  })
  const program = Effect.scoped(Effect.flatMap(plugin.effect(h.context), () => Effect.never))
  const fiber = Effect.runFork(Effect.withLogger(program, collectLogger))

  fibers.push(fiber)
  await h.ready()
}

const storedProblems = (h: Harness, sessionID: string): Problem[] =>
  (h.storage.get(reviewKey(sessionID)) as { problems?: Problem[] } | undefined)?.problems ?? []

const reminderSynthetics = (h: Harness): Harness['synthetics'] =>
  h.synthetics.filter(synthetic => synthetic.text.includes(REMINDER_TEXT))

const reviewSynthetics = (h: Harness): Harness['synthetics'] =>
  h.synthetics.filter(synthetic => synthetic.text.includes(REVIEW_TEXT))

const storedReview = (actual: number): { problems: Problem[] } => ({
  problems: [{
    source: 'agent',
    thresholdName: 'build',
    expectedMax: 4,
    actual,
    message: 'pre-existing problem',
  }],
})

describe('tool-limit-reminder (v2)', () => {
  beforeEach(() => {
    tlrConfig.present = true
    tlrConfig.factor = 0.8
    tlrConfig.padding = 2
    tlrConfig.limits = {}
    tlrConfig.ignoreTools = ['goal']
    tlrConfig.review = { export: true, command: 'just agent_utils/export-opencode-session', writeMarkdown: true }
    shell.exitCode = 0
    shell.commands = []
  })

  afterEach(async () => {
    await Promise.all(fibers.map(fiber => Effect.runPromise(Fiber.interrupt(fiber))))
    fibers.length = 0
  })

  describe('counting', () => {
    it('treats an agent whose lookup fails as unlimited', async () => {
      const h = makeHarness()

      h.agents.set('build', 'fail')
      await register(h)

      const exit = await h.before(toolEvent('read'))

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(h.synthetics).toHaveLength(0)

      const prompt = { sessionID: 'ses_1', prompt: { text: 'hello' } }

      await h.prompt(prompt)

      expect(prompt.prompt.text).toBe('hello')
    })

    it('treats a non-numeric step budget as unlimited', async () => {
      const h = makeHarness()

      h.agents.set('build', { steps: undefined })
      await register(h)

      const exit = await h.before(toolEvent('read'))

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(h.synthetics).toHaveLength(0)
    })

    it('allows the first call below the threshold and counts it exactly once', async () => {
      tlrConfig.limits = { build: 1 }

      const h = makeHarness()

      await register(h)

      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(h.synthetics).toHaveLength(0)

      // The single recorded attempt puts the next call exactly at the limit.
      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(reminderSynthetics(h)).toHaveLength(1)
    })
  })

  describe('boundary', () => {
    it('reminds exactly once when the pre-increment count reaches the limit', async () => {
      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 6; index += 1) {
        expect(Exit.isSuccess(await attempt(h))).toBe(true)
      }

      expect(reminderSynthetics(h)).toHaveLength(1)
      expect(reminderSynthetics(h)[0].text).toContain('You\'ve made 4 tool calls which is the limit')
      expect(reminderSynthetics(h)[0].sessionID).toBe('ses_1')
      expect(reminderSynthetics(h)[0].resume).toBe(false)
    })

    it('records one deduped problem in the padding band and flags the session', async () => {
      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 7; index += 1) {
        await h.before(toolEvent('read'))
      }

      expect(h.sessions.get('ses_1')?.metadata).toEqual({ needsReview: true })
      expect(storedProblems(h, 'ses_1')).toHaveLength(1)
      expect(storedProblems(h, 'ses_1')[0]).toEqual({
        source: 'agent',
        thresholdName: 'build',
        expectedMax: 4,
        actual: 0,
        message: 'The session took 0 tool calls for agent \'build\', exceeding the agent\'s budget of 4 steps. Investigate why the agent exceeded its step budget.',
      })
      expect(reviewSynthetics(h)).toHaveLength(2)
      expect(reviewSynthetics(h)[0].text).toContain('Current count: 6, Limit: 4')
      expect(reviewSynthetics(h)[0].resume).toBe(false)
    })

    it('blocks past the padding band with the byte-identical v1 text', async () => {
      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 7; index += 1) {
        expect(Exit.isSuccess(await attempt(h))).toBe(true)
      }

      const blocked = await h.before(toolEvent('read'))

      expect(Exit.isFailure(blocked)).toBe(true)
      if (!Exit.isFailure(blocked)) return

      const failure = Option.getOrUndefined(Cause.findErrorOption(blocked.cause))

      expect(failure).toBeInstanceOf(Tool.Error)
      if (!(failure instanceof Tool.Error)) return
      expect(failure.message).toBe(BLOCK_TEXT)
      expect(h.synthetics.some(synthetic => synthetic.text.includes('tools are blocked'))).toBe(false)
    })
  })

  describe('two counters', () => {
    it('counts attempts for the gate but completed calls for the report', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 1

      const h = makeHarness()

      await register(h)

      // Two calls completed before the gate ever trips.
      await h.after(afterEvent('completed'))
      await h.after(afterEvent('completed'))

      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(Exit.isSuccess(await attempt(h))).toBe(true)

      expect(reviewSynthetics(h)[0].text).toContain('Current count: 3, Limit: 1')
      expect(storedProblems(h, 'ses_1')[0].actual).toBe(2)

      // The fourth attempt trips the block: attempts advanced, `actual` did not.
      expect(Exit.isFailure(await attempt(h))).toBe(true)
      expect(storedProblems(h, 'ses_1')[0].actual).toBe(2)
    })
  })

  describe('budget tag', () => {
    it('prepends the resolved budget tag to the first prompt only', async () => {
      const h = makeHarness()

      await register(h)

      const first = { sessionID: 'ses_1', prompt: { text: 'hello' } }

      await h.prompt(first)

      expect(first.prompt.text).toBe('<task-budget tool-calls="4" />\nhello')

      const second = { sessionID: 'ses_1', prompt: { text: 'again' } }

      await h.prompt(second)

      expect(second.prompt.text).toBe('again')
    })

    it('skips the tag when the session has no agent', async () => {
      const h = makeHarness()

      h.sessions.set('ses_1', { metadata: {} })
      await register(h)

      const prompt = { sessionID: 'ses_1', prompt: { text: 'hello' } }

      await h.prompt(prompt)

      expect(prompt.prompt.text).toBe('hello')
    })

    it('re-injects the tag after an idle reset', async () => {
      const h = makeHarness()

      await register(h)

      const first = { sessionID: 'ses_1', prompt: { text: 'hello' } }

      await h.prompt(first)
      await h.emit(idle('ses_1'))

      const second = { sessionID: 'ses_1', prompt: { text: 'again' } }

      await h.prompt(second)

      expect(second.prompt.text).toBe('<task-budget tool-calls="4" />\nagain')
    })
  })

  describe('prompt reset', () => {
    it('restarts the attempt count when a new prompt arrives in the same session', async () => {
      const h = makeHarness()

      await register(h)

      const first = { sessionID: 'ses_1', prompt: { text: 'hello' } }

      await h.prompt(first)

      // Four attempts leave `ses_1` one call short of the limit.
      for (let index = 0; index < 4; index += 1) {
        expect(Exit.isSuccess(await attempt(h))).toBe(true)
      }

      expect(reminderSynthetics(h)).toHaveLength(0)

      const second = { sessionID: 'ses_1', prompt: { text: 'again' } }

      await h.prompt(second)

      expect(second.prompt.text).toBe('again')
      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(reminderSynthetics(h)).toHaveLength(0)

      for (let index = 0; index < 4; index += 1) {
        expect(Exit.isSuccess(await attempt(h))).toBe(true)
      }

      expect(reminderSynthetics(h)).toHaveLength(1)
    })

    it('keeps the count of another session when a prompt arrives for a different session', async () => {
      const h = makeHarness()

      h.sessions.set('ses_2', { agent: 'build', metadata: {} })
      await register(h)

      await h.prompt({ sessionID: 'ses_1', prompt: { text: 'hello' } })

      // Four attempts leave `ses_1` one call short of the limit.
      for (let index = 0; index < 4; index += 1) {
        expect(Exit.isSuccess(await attempt(h))).toBe(true)
      }

      const other = { sessionID: 'ses_2', prompt: { text: 'hi' } }

      await h.prompt(other)

      expect(other.prompt.text).toBe('<task-budget tool-calls="4" />\nhi')
      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(reminderSynthetics(h)).toHaveLength(1)
      expect(reminderSynthetics(h)[0].sessionID).toBe('ses_1')
    })
  })

  describe('budget resolution', () => {
    it('resolves an agent budget once and reuses the cache', async () => {
      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 3; index += 1) {
        await h.before(toolEvent('read'))
      }

      expect(h.agentGets).toEqual(['build'])
    })

    it('invalidates the cached budget when the agent selection changes', async () => {
      const h = makeHarness()

      await register(h)
      await h.before(toolEvent('read'))

      await h.emit({ type: 'session.agent.selected', data: { sessionID: 'ses_1', agent: 'build' } })
      await h.before(toolEvent('read'))

      expect(h.agentGets).toEqual(['build', 'build'])
    })

    it('resolves a budget at load even though agent.list is empty', async () => {
      const h = makeHarness()

      h.agentList = []
      await register(h)

      for (let index = 0; index < 5; index += 1) {
        await h.before(toolEvent('read'))
      }

      expect(reminderSynthetics(h)).toHaveLength(1)
      expect(h.agentGets).toEqual(['build'])
    })
  })

  describe('config', () => {
    it('falls back to DEFAULT_TOOL_LIMIT when the section is missing', async () => {
      tlrConfig.present = false

      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 5; index += 1) {
        await h.before(toolEvent('read'))
      }

      expect(reminderSynthetics(h)).toHaveLength(1)
      expect(reminderSynthetics(h)[0].text).toContain('You\'ve made 4 tool calls which is the limit')

      // The default `ignoreTools: ['goal']` keeps `goal` out of the counters.
      await h.before(toolEvent('goal'))

      expect(h.synthetics).toHaveLength(1)
    })

    it('prefers a per-agent limit override over floor(steps * factor)', async () => {
      tlrConfig.limits = { build: 3 }

      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 3; index += 1) {
        await h.before(toolEvent('read'))
      }

      expect(h.synthetics).toHaveLength(0)

      await h.before(toolEvent('read'))

      expect(reminderSynthetics(h)).toHaveLength(1)
      expect(reminderSynthetics(h)[0].text).toContain('You\'ve made 3 tool calls which is the limit')

      const prompt = { sessionID: 'ses_1', prompt: { text: 'hello' } }

      await h.prompt(prompt)

      expect(prompt.prompt.text).toBe('<task-budget tool-calls="3" />\nhello')
    })

    it('excludes ignoreTools from both counters', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 1

      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 3; index += 1) {
        await h.before(toolEvent('goal'))
        await h.after(afterEvent('completed', 'goal'))
      }

      expect(h.synthetics).toHaveLength(0)

      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))

      expect(storedProblems(h, 'ses_1')[0].actual).toBe(0)
    })
  })

  describe('review export', () => {
    it('retains review state when the export fails and retries on the next idle', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 1

      const h = makeHarness()

      await register(h)
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))

      expect(storedProblems(h, 'ses_1')).toHaveLength(1)

      shell.exitCode = 1
      await h.emit(idle('ses_1'))

      expect(storedProblems(h, 'ses_1')).toHaveLength(1)
      expect(h.sessions.get('ses_1')?.metadata).toEqual({ needsReview: true })
      expect(vi.mocked(writeFile)).not.toHaveBeenCalled()

      shell.exitCode = 0
      await h.emit(idle('ses_1'))

      expect(h.storage.has(reviewKey('ses_1'))).toBe(false)
      expect(h.sessions.get('ses_1')?.metadata).toEqual({})
      expect(vi.mocked(writeFile)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(writeFile).mock.calls[0][0]).toBe('/workspace/.tmp/session-review/ses_1/problems.md')
      expect(String(vi.mocked(writeFile).mock.calls[0][1])).toContain('# Reported Threshold Violations')
    })

    it('clears the flag with a read-modify-write that preserves sibling metadata', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 1

      const h = makeHarness()

      h.sessions.set('ses_1', { agent: 'build', metadata: { keep: 'yes' } })
      await register(h)
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))

      await h.emit(idle('ses_1'))

      expect(h.sessions.get('ses_1')?.metadata).toEqual({ keep: 'yes' })
      expect(h.sessionUpdates.at(-1)?.metadata).toEqual({ keep: 'yes' })
      expect(h.sessionUpdates.every(update => update.metadata !== undefined)).toBe(true)
    })
  })

  describe('idle triggers', () => {
    it('exports on a session.status idle event', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 1

      const h = makeHarness()

      await register(h)
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))

      await h.emit(statusIdle('ses_1'))

      expect(h.storage.has(reviewKey('ses_1'))).toBe(false)
    })

    it('resets the attempt counter on idle', async () => {
      tlrConfig.limits = { build: 1 }

      const h = makeHarness()

      await register(h)
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))

      expect(reminderSynthetics(h)).toHaveLength(1)

      await h.emit(idle('ses_1'))
      await h.before(toolEvent('read'))

      expect(reminderSynthetics(h)).toHaveLength(1)
    })

    it('replays a pre-existing review record at registration and drains the scan', async () => {
      const h = makeHarness()

      h.storage.set(reviewKey('ses_a'), storedReview(5))
      h.storage.set(reviewKey('ses_b'), storedReview(6))

      await register(h)

      expect(h.storage.has(reviewKey('ses_a'))).toBe(false)
      expect(h.storage.has(reviewKey('ses_b'))).toBe(false)
      expect(shell.commands).toHaveLength(2)
      expect(shell.commands.every(command => command.includes('export-opencode-session'))).toBe(true)
    })
  })

  describe('isolation and concurrency', () => {
    it('exempts a child session from blocking and keeps the parent counters separate', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 0

      const h = makeHarness()

      h.sessions.set('ses_child', { agent: 'build', parentID: 'ses_parent', metadata: {} })
      await register(h)

      expect(Exit.isSuccess(await attempt(h, 'ses_child'))).toBe(true)
      expect(Exit.isSuccess(await attempt(h, 'ses_child'))).toBe(true)
      expect(reminderSynthetics(h).filter(synthetic => synthetic.sessionID === 'ses_child')).toHaveLength(1)

      // The attempt past the block edge would fail for a top-level session.
      expect(Exit.isSuccess(await attempt(h, 'ses_child'))).toBe(true)

      // The child's calls left the parent's own counter untouched.
      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(h.synthetics.filter(synthetic => synthetic.sessionID === 'ses_1')).toHaveLength(0)
    })

    it('lands both increments for two parallel execute.before calls', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 0

      const h = makeHarness()

      await register(h)

      const [first, second] = await Promise.all([h.before(toolEvent('read')), h.before(toolEvent('read'))])

      expect(Exit.isSuccess(first)).toBe(true)
      expect(Exit.isSuccess(second)).toBe(true)
      // Exactly one call read the pre-increment value 1: no increment was lost.
      expect(reminderSynthetics(h)).toHaveLength(1)
    })

    it('counts an attempt that never completes without inflating the report', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 1

      const h = makeHarness()

      await register(h)

      // A goal-continuation stand-in denies the call from its own `execute.before`,
      // so no `execute.after` ever follows: the attempt still counts.
      await h.before(toolEvent('bash'))
      await h.before(toolEvent('bash'))

      expect(reminderSynthetics(h)).toHaveLength(1)

      await h.before(toolEvent('bash'))

      expect(storedProblems(h, 'ses_1')[0].actual).toBe(0)
    })
  })
})
