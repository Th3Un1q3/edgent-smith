import { beforeEach, describe, expect, it, vi } from 'vitest'

import { executeTool, makeHarness, register, resetWorkflowMocks } from '@tests/workflow/harness'

import { REPO_ROOT } from '@tests/helpers/repo-root'

import { subtaskFactory } from '@tests/workflow/plugin-state'

import { listSubtasksFromSessions } from '@plugins/workflow/subtask-ls'

import { recordTailOutput } from '@plugins/workflow/subtask-tail'

beforeEach(resetWorkflowMocks)

describe('workflow tool handlers', () => {
  it('returns the entries the sessions reader supplied for subtask_ls', async () => {
    const list = vi.fn(() => [
      { id: 'ses_child_1', title: '[ok] first task', time: { created: 1000, updated: 1500 }, outcome: 'succeeded' },
      { id: 'ses_child_2', title: 'second task', time: { created: 2000, updated: 2400 }, outcome: 'failed' },
    ])
    const h = makeHarness([], { list })

    await register(h)

    const result = await executeTool<{ content: string, metadata: { title: string } }>(h.tools[0], { count: 10 })

    expect(list).toHaveBeenCalledWith({ parentID: 'ses_parent' })
    expect(listSubtasksFromSessions).toHaveBeenCalledWith(expect.anything(), 'ses_parent', { count: 10, status: undefined })
    expect(JSON.parse(result.content)).toEqual([
      { description: 'first task', durationMs: 500, task_id: 'ses_child_1', status: 'ok' },
      { description: 'second task', durationMs: 400, task_id: 'ses_child_2', status: 'error' },
    ])
    expect(result.metadata.title).toBe('subtask_ls: 2 subtask(s)')

    const filtered = await executeTool<{ content: string }>(h.tools[0], { count: 1, status: 'ok' })

    expect(listSubtasksFromSessions).toHaveBeenLastCalledWith(expect.anything(), 'ses_parent', { count: 1, status: 'ok' })
    expect(JSON.parse(filtered.content)).toEqual([
      { description: 'first task', durationMs: 500, task_id: 'ses_child_1', status: 'ok' },
    ])
  })

  it('returns an empty list when the reader list call throws', async () => {
    const h = makeHarness([], {
      list: () => {
        throw new Error('list unavailable')
      },
    })

    await register(h)

    const result = await executeTool<{ content: string, metadata: { title: string } }>(h.tools[0], {})

    expect(JSON.parse(result.content)).toEqual([])
    expect(result.metadata.title).toBe('subtask_ls: 0 subtask(s)')
  })

  it('returns an empty array for a task id with no stored output', async () => {
    const h = makeHarness()

    await register(h)

    const result = await executeTool<{ content: string, metadata: { title: string } }>(h.tools[2], { task_id: 'task_missing' })

    expect(JSON.parse(result.content)).toEqual([])
    expect(result.metadata.title).toBe('subtask_tail: 0 output(s)')
  })

  it('returns recorded outputs in the order they were recorded', async () => {
    const h = makeHarness()

    await register(h)
    recordTailOutput({ outputText: 'out-0', task_id: 'task_tail_order', status: 'ok', durationMs: 1 })
    recordTailOutput({ outputText: 'out-1', task_id: 'task_tail_order', status: 'error', durationMs: 2 })

    const result = await executeTool<{ content: string, metadata: { title: string } }>(h.tools[2], { task_id: 'task_tail_order', count: 3 })
    const entries = JSON.parse(result.content) as Array<{ outputText: string }>

    expect(entries.map(entry => entry.outputText)).toEqual(['out-0', 'out-1'])
    expect(result.metadata.title).toBe('subtask_tail: 2 output(s)')
  })

  it('passes count through to the tail helper', async () => {
    const h = makeHarness()

    await register(h)
    recordTailOutput({ outputText: 'out-0', task_id: 'task_tail_count', status: 'ok', durationMs: 1 })
    recordTailOutput({ outputText: 'out-1', task_id: 'task_tail_count', status: 'ok', durationMs: 2 })

    const result = await executeTool<{ content: string }>(h.tools[2], { task_id: 'task_tail_count', count: 1 })
    const entries = JSON.parse(result.content) as Array<{ outputText: string }>

    expect(entries.map(entry => entry.outputText)).toEqual(['out-1'])
  })

  it('passes the documented context and parsed parameters to createSubtask', async () => {
    const subtask = vi.fn(async () => ({ outputText: 'DONE', task_id: 'task_run_1', status: 'ok' as const, durationMs: 12 }))

    subtaskFactory.createSubtask.mockReturnValue(subtask)

    const h = makeHarness()

    await register(h)

    const result = await executeTool<{ metadata: Record<string, unknown> }>(
      h.tools[1],
      { prompt: 'do it', description: 'one thing', agent: 'rug', skills: ['test-design'], timeout_minutes: 5 },
    )
    const [context] = subtaskFactory.createSubtask.mock.calls[0] as [Record<string, unknown>]

    expect(subtaskFactory.createSubtask).toHaveBeenCalledTimes(1)
    expect(context.parentSessionID).toBe('ses_parent')
    expect(context.directory).toBe(REPO_ROOT)
    expect(context.defaultAgent).toBe('rug-swe')
    expect(context.maxSubtasks).toBe(32)
    expect(context.budget).toEqual({ used: 0 })
    expect(context.steps).toEqual([])
    expect(context.logs).toEqual([])
    expect(context.active).toBeInstanceOf(Set)
    expect(context.signal).toBeInstanceOf(AbortSignal)
    expect(subtask).toHaveBeenCalledWith({ prompt: 'do it', description: 'one thing', agent: 'rug', skills: ['test-design'], timeout_minutes: 5 })
    expect(result.metadata).toEqual({ title: 'subtask_run: ok', status: 'ok', task_id: 'task_run_1' })
  })
})
