import { Effect, Logger } from 'effect'

import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

vi.mock('@plugins/helpers/gate-config', () => ({ loadQualityGates: vi.fn() }))
vi.mock('@plugins/helpers/gate-runner', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, runGate: vi.fn() }
})

import { loadQualityGates } from '@plugins/helpers/gate-config'

import { runGate } from '@plugins/helpers/gate-runner'

import type { GateConfig } from '@plugins/types/quality-gate'

import plugin from '@plugins/quality-gate-enforcer'

interface SyntheticAppend {
  sessionID: string
  text: string
  id?: string
  description?: string
  metadata?: Record<string, unknown>
}

interface Harness {
  context: Context
  prompts: Array<{ sessionID: string, text: string, resume?: boolean }>
  synthetics: SyntheticAppend[]
  storage: Map<string, unknown>
  before: (event: unknown) => Promise<void>
  after: (event: unknown) => Promise<void>
}

const makeHarness = (options: {
  appendFailure?: unknown
  loggers?: ReadonlyArray<Logger.Logger<unknown, void>>
} = {}): Harness => {
  const storage = new Map<string, unknown>()
  const prompts: Harness['prompts'] = []
  const synthetics: SyntheticAppend[] = []
  const hooks: Record<string, (event: unknown) => Effect.Effect<unknown>> = {}
  const withLoggers = <A, E>(program: Effect.Effect<A, E>) =>
    options.loggers === undefined ? program : program.pipe(Effect.provide(Logger.layer(options.loggers)))
  const context = {
    options: {},
    location: { directory: '/workspace' },
    tool: {
      hook: (name: string, callback: (event: unknown) => Effect.Effect<unknown>) => {
        hooks['tool:' + name] = callback
        return Effect.succeed({ dispose: Effect.void })
      },
    },
    session: {
      get: () => Effect.succeed({ agent: 'build' }),
      prompt: (input: { sessionID: string, text: string, resume?: boolean }) => {
        prompts.push(input)
        return Effect.succeed(undefined)
      },
      synthetic: (input: SyntheticAppend) => {
        synthetics.push(input)
        return options.appendFailure === undefined
          ? Effect.succeed({})
          : Effect.fail(options.appendFailure)
      },
      hook: (name: string, callback: (event: unknown) => Effect.Effect<unknown>) => {
        hooks['session:' + name] = callback
        return Effect.succeed({ dispose: Effect.void })
      },
    },
    storage: {
      get: (key: string) => Effect.succeed(storage.get(key)),
      set: (key: string, value: unknown) => Effect.sync(() => { storage.set(key, value) }),
      remove: (key: string) => Effect.sync(() => { storage.delete(key) }),
    },
  } as unknown as Context

  return {
    context,
    prompts,
    synthetics,
    storage,
    before: async (event) => { await Effect.runPromise(withLoggers(hooks['tool:execute.before'](event))) },
    after: async (event) => { await Effect.runPromise(withLoggers(hooks['tool:execute.after'](event))) },
  }
}

const register = async (h: Harness): Promise<void> => {
  await Effect.runPromise(Effect.scoped(plugin.effect(h.context)))
}

const captureLogs = (): { logger: Logger.Logger<unknown, void>, lines: string[] } => {
  const lines: string[] = []
  const logger = Logger.make<unknown, void>(({ message }) => {
    const parts = Array.isArray(message) ? message : [message]

    lines.push(parts.map(String).join(' '))
  })
  return { logger, lines }
}

const setGates = (gates: GateConfig[]): void => {
  vi.mocked(loadQualityGates).mockReturnValue({ gates })
}

const editEvent = (path: string) => ({ tool: 'edit', sessionID: 'ses_1', agent: 'build', input: { path } })

describe('quality-gate-enforcer (v2)', () => {
  beforeEach(() => {
    vi.mocked(runGate).mockReset()
    vi.mocked(loadQualityGates).mockReset()
  })

  it('appends one synthetic and no prompt when a pre-change run of an unknown gate transitions', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before(editEvent('src/a.ts'))

    expect(h.synthetics).toHaveLength(1)
    expect(h.prompts).toHaveLength(0)
    expect(h.synthetics[0].text).toContain('lint')
    expect(h.synthetics[0].text).toContain('pass')
    expect(h.synthetics[0].sessionID).toBe('ses_1')
    expect(h.synthetics[0].description).toBe('Quality gate: lint: unknown → pass')
  })

  it('appends one synthetic when a post-change run changes the status', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before(editEvent('src/a.ts'))
    vi.mocked(runGate).mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'boom' })
    await h.after(editEvent('src/a.ts'))

    expect(h.synthetics).toHaveLength(2)
    expect(h.synthetics[1].text).toContain('fail')
    expect(h.prompts).toHaveLength(0)
  })

  it('appends nothing when a gate status is unchanged', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before(editEvent('src/a.ts'))
    await h.after(editEvent('src/a.ts'))

    expect(h.synthetics).toHaveLength(1)
  })

  it('carries the gate name and the transition in metadata without a message id', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before(editEvent('src/a.ts'))

    expect(h.synthetics[0].metadata).toEqual({ quality_gate: 'lint', transition: 'unknown->pass' })
    expect(h.synthetics[0].id).toBeUndefined()
    expect(h.synthetics[0].description).toBe('Quality gate: lint: unknown → pass')
  })

  it('logs a warning and leaves the hook resolved when the append is rejected', async () => {
    const { logger, lines } = captureLogs()
    const h = makeHarness({ appendFailure: new Error('append rejected'), loggers: [logger] })

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)

    await expect(h.before(editEvent('src/a.ts'))).resolves.toBeUndefined()
    expect(h.synthetics).toHaveLength(1)
    expect(h.storage.get('gates/ses_1')).toEqual({ lint: 'pass' })
    expect(lines.some(line => line.includes('synthetic append failed'))).toBe(true)
  })

  it('ignores tools that are not targeted (edit/write)', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(runGate).not.toHaveBeenCalled()
    expect(h.synthetics).toHaveLength(0)
  })

  it('does nothing when no gate matches the touched file', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before(editEvent('README.md'))

    expect(runGate).not.toHaveBeenCalled()
    expect(h.synthetics).toHaveLength(0)
  })

  it('runs every gate matching the touched file', async () => {
    const h = makeHarness()

    setGates([
      { name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] },
      { name: 'test', patterns: ['**/*.test.ts'], commands: ['just test'] },
    ])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before(editEvent('src/a.test.ts'))

    expect(runGate).toHaveBeenCalledTimes(2)
    expect(h.synthetics).toHaveLength(1)
    expect(h.synthetics[0].text).toContain('lint')
    expect(h.synthetics[0].text).toContain('test')
    expect(h.synthetics[0].metadata).toEqual({
      quality_gate: 'lint,test',
      transition: 'unknown->pass,unknown->pass',
    })
  })

  it('persists per-session gate status in ctx.storage', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before(editEvent('src/a.ts'))

    expect(h.storage.get('gates/ses_1')).toEqual({ lint: 'pass' })
  })

  it('matches a path-anchored gate pattern when the tool passes an absolute path', async () => {
    const h = makeHarness()

    setGates([{ name: 'plugins', patterns: ['.opencode/plugins/**/*.ts'], commands: ['just typecheck'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before(editEvent('/workspace/.opencode/plugins/tests/a.test.ts'))

    expect(runGate).toHaveBeenCalledTimes(1)
  })
})
