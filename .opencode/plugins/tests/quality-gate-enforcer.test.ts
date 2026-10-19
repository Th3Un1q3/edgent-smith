import { Effect } from 'effect'

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

interface Harness {
  context: Context
  prompts: Array<{ sessionID: string, text: string, resume?: boolean }>
  storage: Map<string, unknown>
  before: (event: unknown) => Promise<void>
  after: (event: unknown) => Promise<void>
}

const makeHarness = (): Harness => {
  const storage = new Map<string, unknown>()
  const prompts: Harness['prompts'] = []
  const hooks: Record<string, (event: unknown) => Effect.Effect<unknown>> = {}
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
    storage,
    before: async (event) => { await Effect.runPromise(hooks['tool:execute.before'](event)) },
    after: async (event) => { await Effect.runPromise(hooks['tool:execute.after'](event)) },
  }
}

const register = async (h: Harness): Promise<void> => {
  await Effect.runPromise(Effect.scoped(plugin.effect(h.context)))
}

const setGates = (gates: GateConfig[]): void => {
  vi.mocked(loadQualityGates).mockReturnValue({ gates, debounceMs: 0 })
}

describe('quality-gate-enforcer (v2)', () => {
  beforeEach(() => {
    vi.mocked(runGate).mockReset()
    vi.mocked(loadQualityGates).mockReset()
  })

  it('runs a matching gate on edit and reports the pre-change transition', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before({ tool: 'edit', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.prompts).toHaveLength(1)
    expect(h.prompts[0].text).toContain('lint')
    expect(h.prompts[0].text).toContain('pass')
    expect(h.prompts[0].resume).toBe(false)
  })

  it('reports a post-change transition when a gate status changes', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before({ tool: 'edit', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    vi.mocked(runGate).mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'boom' })
    await h.after({ tool: 'edit', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.prompts).toHaveLength(2)
    expect(h.prompts[1].text).toContain('fail')
  })

  it('does not report when a gate status is unchanged', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before({ tool: 'edit', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    await h.after({ tool: 'edit', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.prompts).toHaveLength(1)
  })

  it('ignores tools that are not targeted (edit/write)', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(runGate).not.toHaveBeenCalled()
    expect(h.prompts).toHaveLength(0)
  })

  it('does nothing when no gate matches the touched file', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before({ tool: 'edit', sessionID: 'ses_1', agent: 'build', input: { path: 'README.md' } })
    expect(runGate).not.toHaveBeenCalled()
    expect(h.prompts).toHaveLength(0)
  })

  it('runs every gate matching the touched file', async () => {
    const h = makeHarness()

    setGates([
      { name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] },
      { name: 'test', patterns: ['**/*.test.ts'], commands: ['just test'] },
    ])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before({ tool: 'edit', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.test.ts' } })
    expect(runGate).toHaveBeenCalledTimes(2)
    expect(h.prompts[0].text).toContain('lint')
    expect(h.prompts[0].text).toContain('test')
  })

  it('persists per-session gate status in ctx.storage', async () => {
    const h = makeHarness()

    setGates([{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before({ tool: 'edit', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.storage.get('gates/ses_1')).toEqual({ lint: 'pass' })
  })

  it('matches a path-anchored gate pattern when the tool passes an absolute path', async () => {
    const h = makeHarness()

    setGates([{ name: 'plugins', patterns: ['.opencode/plugins/**/*.ts'], commands: ['just typecheck'] }])
    vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
    await register(h)
    await h.before({ tool: 'edit', sessionID: 'ses_1', agent: 'build', input: { path: '/workspace/.opencode/plugins/tests/a.test.ts' } })
    expect(runGate).toHaveBeenCalledTimes(1)
  })
})
