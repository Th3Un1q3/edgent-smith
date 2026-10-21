import { beforeEach, describe, expect, it } from 'vitest'

import { listSteps, readStoredSteps, recordSteps } from '@plugins/helpers/subtask-ls'
import type { StepRecord } from '@plugins/helpers/workflow-types'

const step = (overrides: Partial<StepRecord> = {}): StepRecord => ({
  description: 'do work',
  task_id: 'task_1',
  status: 'ok',
  durationMs: 1200,
  truncated: false,
  ...overrides,
})

describe('subtask_ls listSteps', () => {
  beforeEach(() => {
    recordSteps([])
  })

  it('returns an empty array when no steps ran', () => {
    expect(listSteps([], {})).toEqual([])
  })

  it('maps each step to description, duration, task id, and status', () => {
    const entries = listSteps([step({ description: 'migrate db', task_id: 'task_9', status: 'error', durationMs: 321 })], {})

    expect(entries).toEqual([{ description: 'migrate db', durationMs: 321, task_id: 'task_9', status: 'error' }])
  })

  it('defaults to 10 rows', () => {
    const steps = Array.from({ length: 15 }, (_, index) => step({ description: `step ${index}`, task_id: `task_${index}` }))

    expect(listSteps(steps, {})).toHaveLength(10)
  })

  it('caps count at 50 rows', () => {
    const steps = Array.from({ length: 60 }, (_, index) => step({ description: `step ${index}`, task_id: `task_${index}` }))

    const entries = listSteps(steps, { count: 500 })

    expect(entries).toHaveLength(50)
  })

  it('filters by status when requested', () => {
    const steps = [step({ status: 'ok' }), step({ status: 'error', task_id: 'task_e' })]

    expect(listSteps(steps, { status: 'error' })).toEqual([
      { description: 'do work', durationMs: 1200, task_id: 'task_e', status: 'error' },
    ])
  })

  it('truncates long descriptions to a safe length', () => {
    const entries = listSteps([step({ description: 'x'.repeat(200) })], {})

    expect(entries[0].description.length).toBeLessThanOrEqual(80)
  })

  it('reads back the last recorded run snapshot', () => {
    recordSteps([step({ task_id: 'task_stored' })])

    expect(readStoredSteps().map(stored => stored.task_id)).toEqual(['task_stored'])
    expect(listSteps(readStoredSteps(), {})).toHaveLength(1)
  })
})
