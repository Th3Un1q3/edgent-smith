import { Effect, Stream } from 'effect'

import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

const harness = vi.hoisted(() => {
  const defaults = {
    instructions: '.agents/skills/task-delegation/SKILL.md',
    agents: ['rug', 'rug-workflow'],
  }
  const config: { plugins: { workflow?: { instructions?: unknown, agents?: unknown } } } = {
    plugins: { workflow: { ...defaults } },
  }
  return { config }
})

vi.mock('@plugins/config/harness.config', () => ({ harnessConfig: harness.config }))

const runMock = vi.hoisted(() => ({
  runStandaloneSubtask: vi.fn(async () => ({ outputText: 'OUT', task_id: 'ses_child', status: 'ok', durationMs: 10, truncated: false })),
}))

vi.mock('@plugins/helpers/subtask-run', () => runMock)

const entryClient = vi.hoisted(() => ({
  writeEntry: vi.fn(async () => ({ status: 'written' })),
  removeEntry: vi.fn(async () => ({ status: 'absent' })),
}))

vi.mock('@plugins/helpers/instruction-entry-client', () => ({
  writeEntry: entryClient.writeEntry,
  removeEntry: entryClient.removeEntry,
  entryValueBytes: (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8'),
  get MAX_ENTRY_VALUE_BYTES() { return 256 * 1024 },
}))

import plugin from '@plugins/workflow'

import { REPO_ROOT } from '@tests/helpers/repo-root'

const makeHarness = () => {
  const tools: Array<Record<string, unknown>> = []
  const context = {
    options: {},
    location: { directory: REPO_ROOT },
    event: { subscribe: () => Stream.empty },
    tool: {
      transform: (callback: (editor: unknown) => void) => {
        callback({
          add: (tool: unknown) => { tools.push(tool as unknown as Record<string, unknown>) },
          namespace: () => {},
          update: () => {},
          remove: () => {},
          list: () => [],
          get: () => {},
        })
        return Effect.succeed({ dispose: Effect.void })
      },
      hook: () => Effect.succeed({ dispose: Effect.void }),
    },
    session: {
      create: () => Effect.succeed({ id: 'ses_child' }),
      prompt: () => Effect.succeed({}),
      fork: () => Effect.succeed({ id: 'ses_fork' }),
      context: () => Effect.succeed([]),
      interrupt: () => Effect.succeed(undefined),
      update: () => Effect.succeed(undefined),
    },
  } as unknown as Context
  return { context, tools }
}

const register = async (h: ReturnType<typeof makeHarness>): Promise<void> => {
  await Effect.runPromise(Effect.scoped(plugin.effect(h.context)))
}

describe('standalone trio tool registration', () => {
  beforeEach(() => {
    runMock.runStandaloneSubtask.mockClear()
  })

  it('registers the standalone trio (subtask_ls/run/tail)', async () => {
    const h = makeHarness()

    await register(h)

    const names = h.tools.map(tool => tool.name)

    expect(h.tools).toHaveLength(3)
    expect(names).toContain('subtask_ls')
    expect(names).toContain('subtask_run')
    expect(names).toContain('subtask_tail')
    expect(names).not.toContain('workflow')
  })

  it('executes a standalone subtask and returns status/output', async () => {
    const h = makeHarness()

    await register(h)

    const tool = h.tools.find(candidate => candidate.name === 'subtask_run')
    if (tool === undefined) throw new Error('subtask_run not registered')
    const execute = tool.execute as (value: unknown, context_: unknown) => Effect.Effect<unknown>

    const result = await Effect.runPromise(
      execute(
        { prompt: 'do work', description: 'do work' },
        { sessionID: 'ses_parent', agent: 'build', messageID: 'msg_1', id: 'call_1', progress: () => Effect.void },
      ),
    ) as unknown as Record<string, unknown>

    expect(runMock.runStandaloneSubtask).toHaveBeenCalledTimes(1)
    expect(String(result.content)).toContain('"status":"ok"')
    expect((result.metadata as { title: string }).title).toContain('subtask_run')
  })

  it('exposes the subtask status in metadata without changing the content string', async () => {
    const h = makeHarness()

    await register(h)

    const tool = h.tools.find(candidate => candidate.name === 'subtask_run')
    if (tool === undefined) throw new Error('subtask_run not registered')
    const execute = tool.execute as (value: unknown, context_: unknown) => Effect.Effect<unknown>

    const result = await Effect.runPromise(
      execute(
        { prompt: 'do work', description: 'do work' },
        { sessionID: 'ses_parent', agent: 'build', messageID: 'msg_1', id: 'call_1', progress: () => Effect.void },
      ),
    ) as unknown as Record<string, unknown>

    expect(result.content).toBe(JSON.stringify({
      outputText: 'OUT',
      task_id: 'ses_child',
      status: 'ok',
      durationMs: 10,
      truncated: false,
    }))
    expect(result.metadata).toMatchObject({ status: 'ok', task_id: 'ses_child', truncated: false })
  })
})
