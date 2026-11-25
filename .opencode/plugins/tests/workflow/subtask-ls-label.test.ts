import { beforeEach, describe, expect, it } from 'vitest'

import { executeTool, makeHarness, register, resetWorkflowMocks } from '@tests/workflow/harness'
import { REPO_ROOT } from '@tests/helpers/repo-root'
import { entryClient } from '@tests/workflow/plugin-state'

import { encodeLabelDocument } from '@plugins/workflow/subtask-labels'
import type { LabelDocument } from '@plugins/workflow/subtask-labels'

const PARENT = 'ses_parent'
const BOUND_AT = '2026-11-24T00:00:00.000Z'

const CHILDREN = [
  { id: 'ses_child_1', title: 'first task', time: { created: 1000, updated: 1500 }, outcome: 'succeeded' },
  { id: 'ses_child_2', title: 'second task', time: { created: 2000, updated: 2400 }, outcome: 'failed' },
]

interface LsOutput {
  content: string
  metadata: { title: string }
}

const documentWith = (...bindings: Array<[string, string]>): LabelDocument => ({
  version: 1,
  bindings: bindings.map(([label, taskId]) => ({ label, taskId, boundAt: BOUND_AT })),
})

const entryValue = (document: LabelDocument) => ({
  key: 'workflow.labels',
  value: { text: encodeLabelDocument(document), source: 'workflow.plugins', priority: 1 },
})

const listLs = async (children: Array<Record<string, unknown>> = CHILDREN): Promise<LsOutput> => {
  const h = makeHarness([], { list: () => children })
  await register(h)
  return await executeTool<LsOutput>(h.tools[0], {})
}

const entriesOf = (output: LsOutput): Array<Record<string, unknown>> => JSON.parse(output.content)

beforeEach(() => {
  resetWorkflowMocks()
  entryClient.findEntry.mockReset()
})

describe('subtask_ls labels', () => {
  it('carries the label that bound the entry child', async () => {
    entryClient.findEntry.mockResolvedValue(entryValue(documentWith(['build.api', 'ses_child_1'])))

    const entries = entriesOf(await listLs())

    expect(entries[0]).toMatchObject({ task_id: 'ses_child_1', label: 'build.api' })
  })

  it('adds no label key to an entry whose child is not bound', async () => {
    entryClient.findEntry.mockResolvedValue(entryValue(documentWith(['build.api', 'ses_child_9'])))

    const [first] = entriesOf(await listLs())

    expect(Object.keys(first)).toEqual(['description', 'durationMs', 'task_id', 'status'])
    expect(first).not.toHaveProperty('label')
  })

  it('gives each of two bound children its own label', async () => {
    entryClient.findEntry.mockResolvedValue(
      entryValue(documentWith(['build.api', 'ses_child_1'], ['review', 'ses_child_2'])),
    )

    const entries = entriesOf(await listLs())

    expect(entries.map(entry => entry.label)).toEqual(['build.api', 'review'])
  })

  it('leaves the entries unchanged when the labels document is unreadable', async () => {
    entryClient.findEntry.mockRejectedValue(new Error('entry store unavailable'))

    const entries = entriesOf(await listLs())

    expect(entries).toEqual([
      { description: 'first task', durationMs: 500, task_id: 'ses_child_1', status: 'ok' },
      { description: 'second task', durationMs: 400, task_id: 'ses_child_2', status: 'error' },
    ])
  })

  it('leaves the entries unchanged when the labels document is malformed', async () => {
    entryClient.findEntry.mockResolvedValue({ key: 'workflow.labels', value: { text: '{not json' } })

    const entries = entriesOf(await listLs())

    expect(entries.every(entry => !('label' in entry))).toBe(true)
  })

  it('keeps an empty list empty when the labels document is unreadable', async () => {
    entryClient.findEntry.mockRejectedValue(new Error('entry store unavailable'))

    expect(entriesOf(await listLs([]))).toEqual([])
  })

  it('reads the labels document exactly once per call and writes nothing', async () => {
    entryClient.findEntry.mockResolvedValue(entryValue(documentWith(['build.api', 'ses_child_1'])))

    await listLs()

    expect(entryClient.findEntry).toHaveBeenCalledTimes(1)
    expect(entryClient.findEntry).toHaveBeenCalledWith(PARENT, 'workflow.labels', REPO_ROOT)
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
  })
})
