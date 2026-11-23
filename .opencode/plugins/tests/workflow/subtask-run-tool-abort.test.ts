import { Effect, Fiber, Stream } from 'effect'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

const harness = vi.hoisted(() => {
  const defaults = {
    instructions: '.agents/skills/task-delegation/SKILL.md',
    agents: ['rug', 'rug-swe'],
  }
  const config: { plugins: { workflow?: { instructions?: unknown, agents?: unknown } } } = {
    plugins: { workflow: { ...defaults } },
  }
  return { config }
})

vi.mock('@plugins/config/harness', () => ({ harnessConfig: harness.config }))

// The real `createSubtask` runs against this fake client so the child-session
// abort is observed end to end; the prompt stays pending until interrupted.
const client = vi.hoisted(() => ({
  session: {
    create: vi.fn(async () => ({ data: { id: 'ses_child' } })),
    prompt: vi.fn(() => new Promise(() => {})),
    abort: vi.fn(async () => ({ data: true })),
  },
}))

vi.mock('@plugins/workflow/client-adapter', () => ({ createWorkflowClient: () => client }))

const entryClient = vi.hoisted(() => ({
  writeEntry: vi.fn(async () => ({ status: 'written' })),
  removeEntry: vi.fn(async () => ({ status: 'absent' })),
}))

vi.mock('@plugins/helpers/instructions/entry-client', () => ({
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

const toolContext = {
  sessionID: 'ses_parent',
  agent: 'build',
  messageID: 'msg_1',
  id: 'call_1',
  progress: () => Effect.void,
}

const executeSubtaskRun = async (): Promise<(input: unknown, context_: unknown) => Effect.Effect<unknown>> => {
  const h = makeHarness()
  await Effect.runPromise(Effect.scoped(plugin.effect(h.context)))
  const tool = h.tools.find(candidate => candidate.name === 'subtask_run')
  if (tool === undefined) throw new Error('subtask_run not registered')
  return tool.execute as (input: unknown, context_: unknown) => Effect.Effect<unknown>
}

const waitFor = async (isDone: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (isDone()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error('condition not met within 1s')
}

describe('subtask_run parent interruption', () => {
  beforeEach(() => {
    client.session.create.mockClear()
    client.session.prompt.mockClear()
    client.session.abort.mockClear()
  })

  it('returns the subtask result when nothing interrupts the call', async () => {
    client.session.prompt.mockImplementation(async () => ({
      data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] },
    }))
    const execute = await executeSubtaskRun()

    const result = await Effect.runPromise(
      execute({ prompt: 'do work', description: 'do work' }, toolContext),
    ) as Record<string, unknown>

    expect(String(result.content)).toContain('"status":"ok"')
    expect(String(result.content)).toContain('"task_id":"ses_child"')
    expect(client.session.abort).not.toHaveBeenCalled()
  })

  it('aborts the spawned child session when the tool call is interrupted', async () => {
    const execute = await executeSubtaskRun()

    const fiber = Effect.runFork(execute({ prompt: 'do work', description: 'do work' }, toolContext))
    await waitFor(() => client.session.prompt.mock.calls.length === 1)
    const promptsBeforeInterrupt = client.session.prompt.mock.calls.length

    await Effect.runPromise(Fiber.interrupt(fiber))
    await waitFor(() => client.session.abort.mock.calls.length > 0)

    expect(client.session.abort).toHaveBeenCalledWith({ path: { id: 'ses_child' } })
    expect(client.session.prompt.mock.calls.length).toBe(promptsBeforeInterrupt)
  })
})
