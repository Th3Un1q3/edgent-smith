import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Effect } from 'effect'

import { collectLogger, makeHarness, register, resetWorkflowMocks } from '@tests/workflow/harness'
import type { Harness } from '@tests/workflow/harness'
import { entryClient, subtaskFactory } from '@tests/workflow/plugin-state'

import { encodeLabelDocument } from '@plugins/workflow/subtask-labels'
import type { LabelDocument } from '@plugins/workflow/subtask-labels'
import type { SubtaskParameters, SubtaskResult } from '@plugins/workflow/contracts'

const CHILD = 'ses_child'
const BOUND_AT = '2026-11-24T00:00:00.000Z'

const OK: SubtaskResult = { outputText: 'OUT', task_id: CHILD, status: 'ok', durationMs: 1 }

interface ToolOutput {
  result: SubtaskResult
  metadata: Record<string, unknown>
  logs: Harness['logs']
}

const bound = (label: string): LabelDocument => ({
  version: 1,
  bindings: [{ label, taskId: CHILD, boundAt: BOUND_AT }],
})

const entryValue = (document: LabelDocument): { key: string, value: unknown } => ({
  key: 'workflow.labels',
  value: { text: encodeLabelDocument(document), source: 'workflow.plugins', priority: 1 },
})

const installRunner = (result: SubtaskResult): ReturnType<typeof vi.fn> => {
  const runner = vi.fn(async () => result)

  subtaskFactory.createSubtask.mockReturnValue(runner as never)

  return runner
}

const childSession = (outcome?: string): Record<string, unknown> => ({
  get: () => Effect.succeed({ data: outcome === undefined ? { id: CHILD } : { id: CHILD, outcome } }),
})

const prepared = async (session: Record<string, unknown> = {}) => {
  const h = makeHarness([], session)

  await register(h)

  const invoke = async (input: unknown): Promise<ToolOutput> => {
    const logs: Harness['logs'] = []
    const execute = h.tools[1].execute as (
      index: unknown,
      c: { sessionID: string },
    ) => Effect.Effect<Record<string, unknown>>
    const output = await Effect.runPromise(
      Effect.withLogger(collectLogger(logs))(execute(input, { sessionID: 'ses_parent' })),
    )

    return {
      result: JSON.parse(output.content as string) as SubtaskResult,
      metadata: output.metadata as Record<string, unknown>,
      logs,
    }
  }

  return { h, invoke }
}

const labelled = { prompt: 'do work', description: 'do work', label: 'build' }

const creationCalls = (runner: ReturnType<typeof vi.fn>): number =>
  runner.mock.calls.filter(([parameters]) => (parameters as SubtaskParameters).task_id === undefined).length

const isAbsent = (value: unknown): boolean => value === undefined || value === ''

beforeEach(() => {
  resetWorkflowMocks()
  entryClient.findEntry.mockReset()
})

describe('subtask_run label binding', () => {
  it('binds a new labelled dispatch and echoes the label', async () => {
    const runner = installRunner(OK)
    const { invoke } = await prepared()

    const outcome = await invoke(labelled)

    const [, key, value] = entryClient.writeEntry.mock.calls[0]

    expect(key).toBe('workflow.labels')
    expect(key).toBe('workflow.labels')
    expect((value as { text: string }).text).toContain(CHILD)
    expect(JSON.parse((value as { text: string }).text).bindings).toEqual([
      { label: 'build', taskId: CHILD, boundAt: expect.any(String) },
    ])
    expect(outcome.result.task_id).toBe(CHILD)
    expect(outcome.result.label).toBe('build')
    expect(outcome.metadata).toMatchObject({ status: 'ok', task_id: CHILD, label: 'build' })
    expect(creationCalls(runner)).toBe(1)
  })

  it('resumes a finished child and creates no second one', async () => {
    const runner = installRunner(OK)

    entryClient.findEntry.mockResolvedValue(entryValue(bound('build')))

    const { invoke } = await prepared(childSession('succeeded'))
    const outcome = await invoke(labelled)

    expect(creationCalls(runner)).toBe(0)
    expect(runner.mock.calls[0][0]).toMatchObject({ task_id: CHILD })
    expect((runner.mock.calls[0][0] as SubtaskParameters).label).toBeUndefined()
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
    expect(outcome.result.task_id).toBe(CHILD)
    expect(outcome.result.label).toBe('build')
  })

  it('resumes a child whose last turn came back empty', async () => {
    const runner = installRunner({ ...OK, status: 'empty', outputText: '' })

    entryClient.findEntry.mockResolvedValue(entryValue(bound('build')))

    const { invoke } = await prepared(childSession('succeeded'))
    const outcome = await invoke(labelled)

    expect(creationCalls(runner)).toBe(0)
    expect(outcome.result.task_id).toBe(CHILD)
    expect(outcome.result.status).toBe('empty')
  })

  it('refuses a running child and names it without creating one', async () => {
    const runner = installRunner(OK)

    entryClient.findEntry.mockResolvedValue(entryValue(bound('build')))

    const { invoke } = await prepared(childSession())
    const outcome = await invoke(labelled)

    expect(outcome.result.status).toBe('error')
    expect(outcome.result.error).toContain('build')
    expect(outcome.result.error).toContain(CHILD)
    expect(outcome.result.label).toBe('build')
    expect(runner).not.toHaveBeenCalled()
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
  })

  it.each(['failed', 'interrupted'])('refuses a dead child (%s) and names it', async (outcomeName) => {
    const runner = installRunner(OK)

    entryClient.findEntry.mockResolvedValue(entryValue(bound('build')))

    const { invoke } = await prepared(childSession(outcomeName))
    const outcome = await invoke(labelled)

    expect(outcome.result.status).toBe('error')
    expect(outcome.result.error).toContain(CHILD)
    expect(runner).not.toHaveBeenCalled()
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
  })

  it('dispatches once for two concurrent calls on one unbound label', async () => {
    const runner = installRunner(OK)
    let stored: unknown

    entryClient.findEntry.mockImplementation(async () => stored)
    entryClient.writeEntry.mockImplementation(async (_session, _key, value) => {
      stored = { key: 'workflow.labels', value }
      return { status: 'written' }
    })

    const { invoke } = await prepared(childSession('succeeded'))
    const [first, second] = await Promise.all([invoke(labelled), invoke(labelled)])

    expect(first.result.task_id).toBe(CHILD)
    expect(second.result.task_id).toBe(CHILD)
    expect(creationCalls(runner)).toBe(1)
    expect(entryClient.writeEntry).toHaveBeenCalledTimes(1)
    expect((stored as { value: { text: string } }).value.text).toContain('"label":"build"')
  })

  it('refuses an invalid label through the tool path before any child work', async () => {
    const runner = installRunner(OK)
    const { invoke } = await prepared()

    const outcome = await invoke({ ...labelled, label: 'Build Work' })

    expect(outcome.result.status).toBe('error')
    expect(outcome.result.error).toContain('Build Work')
    expect(subtaskFactory.createSubtask).not.toHaveBeenCalled()
    expect(runner).not.toHaveBeenCalled()
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
  })

  it('refuses label beside task_id through the tool path', async () => {
    const runner = installRunner(OK)
    const { invoke } = await prepared()

    const outcome = await invoke({ ...labelled, task_id: CHILD })

    expect(outcome.result.error).toContain('label_task_conflict')
    expect(subtaskFactory.createSubtask).not.toHaveBeenCalled()
    expect(runner).not.toHaveBeenCalled()
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
  })

  it('refuses label beside fork_from through the tool path', async () => {
    const runner = installRunner(OK)
    const { invoke } = await prepared()

    const outcome = await invoke({ ...labelled, fork_from: CHILD })

    expect(outcome.result.error).toContain('label_fork_conflict')
    expect(subtaskFactory.createSubtask).not.toHaveBeenCalled()
    expect(runner).not.toHaveBeenCalled()
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'an invalid label', input: { ...labelled, label: 'Build Work' }, namesChild: false },
    { name: 'a label beside fork_from', input: { ...labelled, fork_from: 'ses_fork_source' }, namesChild: false },
    { name: 'a label beside task_id', input: { ...labelled, task_id: CHILD }, namesChild: true },
  ])('refuses $name without reporting a child', async ({ input, namesChild }) => {
    const runner = installRunner(OK)
    const { invoke } = await prepared()

    const outcome = await invoke(input)

    expect(outcome.result.status).toBe('error')
    expect(isAbsent(outcome.result.task_id)).toBe(true)
    expect(isAbsent(outcome.metadata.task_id)).toBe(true)
    expect(String(outcome.result.error).includes(CHILD)).toBe(namesChild)
    expect(runner).not.toHaveBeenCalled()
  })

  it('persists both rows for two concurrent first-binds on different labels', async () => {
    const runner = installRunner(OK)
    let stored: unknown

    entryClient.findEntry.mockImplementation(async () => stored)
    entryClient.writeEntry.mockImplementation(async (_session, _key, value) => {
      stored = { key: 'workflow.labels', value }
      return { status: 'written' }
    })

    const { invoke } = await prepared(childSession('succeeded'))
    await Promise.all([invoke(labelled), invoke({ ...labelled, label: 'review' })])

    const rows = JSON.parse((stored as { value: { text: string } }).value.text).bindings

    expect(rows).toHaveLength(2)
    expect(rows.map((row: { label: string }) => row.label)).toContain('build')
    expect(rows.map((row: { label: string }) => row.label)).toContain('review')
    expect(entryClient.writeEntry).toHaveBeenCalledTimes(2)
    expect(creationCalls(runner)).toBe(2)
  })

  it('leaves an unlabelled dispatch unchanged', async () => {
    const runner = installRunner(OK)
    const { invoke } = await prepared()

    const outcome = await invoke({ prompt: 'do work', description: 'do work' })

    expect(entryClient.findEntry).not.toHaveBeenCalled()
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
    expect(runner.mock.calls[0][0]).toEqual({ prompt: 'do work', description: 'do work' })
    expect(outcome.result.label).toBeUndefined()
    expect(outcome.metadata.label).toBeUndefined()
  })

  it('returns an error naming the child when the binding write fails', async () => {
    const runner = installRunner(OK)

    entryClient.writeEntry.mockResolvedValue({ status: 'failed', reason: 'oversize' })

    const { invoke } = await prepared()
    const outcome = await invoke(labelled)

    expect(outcome.result.status).toBe('error')
    expect(outcome.result.task_id).toBe(CHILD)
    expect(outcome.result.error).toContain('build')
    expect(outcome.result.error).toContain(CHILD)
    expect(creationCalls(runner)).toBe(1)
    expect(JSON.stringify(outcome.logs)).toContain('workflow.labels.bind_failed')
  })
})
