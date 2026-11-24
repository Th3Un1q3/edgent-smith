import { Effect, Logger, Stream } from 'effect'

import { describe, expect, it, vi } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

const harness = vi.hoisted(() => ({
  config: { plugins: { workflow: { instructions: '.agents/skills/task-delegation/SKILL.md', agents: ['rug', 'rug-swe'] } } },
}))

const subtaskLs = vi.hoisted(() => ({ listSubtasksFromSessions: vi.fn() }))

const serviceClient = vi.hoisted(() => ({ getClient: vi.fn(), listMessages: vi.fn() }))

vi.mock('@plugins/config/harness', () => ({ harnessConfig: harness.config }))

vi.mock('@plugins/helpers/runtime/service-client', () => ({ getClient: serviceClient.getClient }))

vi.mock('@plugins/helpers/instructions/entry-client', () => ({ writeEntry: vi.fn(), removeEntry: vi.fn() }))

vi.mock('@plugins/workflow/subtask', () => ({ createSubtask: vi.fn() }))

vi.mock('@plugins/workflow/subtask-ls', () => ({ listSubtasksFromSessions: subtaskLs.listSubtasksFromSessions }))

import { writeEntry } from '@plugins/helpers/instructions/entry-client'

import plugin, { handleSessionEvent } from '@plugins/workflow'

import { REPO_ROOT } from '@tests/helpers/repo-root'

interface Harness {
  context: Context
  tools: Array<Record<string, unknown>>
}

const makeHarness = (): Harness => {
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

const register = async (h: Harness): Promise<void> => {
  await Effect.runPromise(Effect.scoped(plugin.effect(h.context)))
}

const findTool = (tools: Array<Record<string, unknown>>, name: string): Record<string, unknown> => {
  const tool = tools.find(candidate => candidate.name === name)
  if (tool === undefined) throw new Error(`${name} was not registered`)
  return tool
}

interface ToolResult {
  content: string
  metadata: { title: string }
}

const executeTool = async (tool: Record<string, unknown>, input: unknown, sessionID = 'ses_parent'): Promise<ToolResult> => {
  const execute = tool.execute as (toolInput: unknown, toolContext: { sessionID: string }) => Effect.Effect<ToolResult>

  return await Effect.runPromise(execute(input, { sessionID }))
}

describe('workflow tool edge inputs', () => {
  it('returns the documented empty result for subtask_outputs with an empty task_id', async () => {
    const h = makeHarness()

    await register(h)
    serviceClient.getClient.mockResolvedValue({ message: { list: serviceClient.listMessages } })

    const result = await executeTool(findTool(h.tools, 'subtask_outputs'), { task_id: '' })

    expect(JSON.parse(result.content)).toEqual([])
    expect(result.metadata.title).toBe('subtask_outputs: 0 output(s)')
    expect(serviceClient.listMessages).not.toHaveBeenCalled()
  })

  it('returns the documented empty result for subtask_outputs when task_id is omitted', async () => {
    const h = makeHarness()

    await register(h)
    serviceClient.getClient.mockResolvedValue({ message: { list: serviceClient.listMessages } })

    const result = await executeTool(findTool(h.tools, 'subtask_outputs'), {})

    expect(JSON.parse(result.content)).toEqual([])
    expect(result.metadata.title).toBe('subtask_outputs: 0 output(s)')
    expect(serviceClient.listMessages).not.toHaveBeenCalled()
  })

  it('returns an empty list when the sessions listing yields no value', async () => {
    // A rejecting reader is not this branch: Effect.promise turns a rejection
    // into a defect, which Effect.orElseSucceed does not catch.
    subtaskLs.listSubtasksFromSessions.mockResolvedValue(undefined)

    const h = makeHarness()

    await register(h)

    const result = await executeTool(findTool(h.tools, 'subtask_ls'), {})

    expect(JSON.parse(result.content)).toEqual([])
    expect(result.metadata.title).toBe('subtask_ls: 0 subtask(s)')
  })

  it('labels a failed entry write with neither error nor reason as an unknown error', async () => {
    vi.mocked(writeEntry).mockResolvedValue({ status: 'failed' })

    const logs: Array<ReadonlyArray<unknown>> = []
    const logger = Logger.make<unknown, void>(({ message }) => {
      logs.push(Array.isArray(message) ? message : [message])
    })
    const agentAllowlist = new Set(['rug'])

    await Effect.runPromise(Effect.withLogger(logger)(handleSessionEvent(
      { type: 'session.created', data: { sessionID: 'ses_edge_unknown', agent: 'rug' } },
      { agentAllowlist, block: 'BLOCK-BODY' },
    )))

    expect(logs).toContainEqual([
      'workflow.instructions.error',
      expect.objectContaining({ message: 'workflow instructions: write failed: unknown error' }),
    ])
  })
})
