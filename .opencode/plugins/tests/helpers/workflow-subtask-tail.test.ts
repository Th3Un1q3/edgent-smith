import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readTailOutputs, recordTailOutput, tailOutputs } from '@plugins/helpers/subtask-tail'
import type { SubtaskResult } from '@plugins/helpers/workflow-types'

const result = (overrides: Partial<SubtaskResult> = {}): SubtaskResult => ({
  outputText: 'hello output',
  task_id: 'task_1',
  status: 'ok',
  durationMs: 100,
  truncated: false,
  ...overrides,
})

describe('subtask_tail tailOutputs', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('returns an empty array for an unknown task id', () => {
    expect(tailOutputs(`unknown-${Date.now()}`, {})).toEqual([])
  })

  it('returns the last output recorded for a task id', () => {
    const id = `task-tail-${Date.now()}`
    recordTailOutput(result({ task_id: id, outputText: 'first' }))
    recordTailOutput(result({ task_id: id, outputText: 'second' }))

    const entries = tailOutputs(id, {})

    expect(entries.map(entry => entry.outputText)).toEqual(['first', 'second'])
    expect(entries[0].task_id).toBe(id)
  })

  it('defaults to 3 rows and caps count at 5', () => {
    const id = `task-cap-${Date.now()}`
    for (let index = 0; index < 8; index += 1) {
      recordTailOutput(result({ task_id: id, outputText: `out ${index}` }))
    }

    expect(tailOutputs(id, {})).toHaveLength(3)
    expect(tailOutputs(id, { count: 500 })).toHaveLength(5)
  })

  it('truncates entries larger than 12KB and flags truncated', () => {
    const id = `task-trunc-${Date.now()}`
    recordTailOutput(result({ task_id: id, outputText: 'x'.repeat(13 * 1024) }))

    const entries = readTailOutputs(id)

    expect(entries).toHaveLength(1)
    expect(entries[0].outputText.length).toBeLessThanOrEqual(12 * 1024)
    expect(entries[0].truncated).toBe(true)
  })

  it('exposes status metadata on each entry', () => {
    const id = `task-meta-${Date.now()}`
    recordTailOutput(result({ task_id: id, status: 'error', outputText: 'boom' }))

    const entries = tailOutputs(id, {})

    expect(entries[0]).toMatchObject({ task_id: id, status: 'error' })
  })
})
