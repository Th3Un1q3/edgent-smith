import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listSteps, listSubtasksFromSessions, readStoredSteps, recordSteps } from '@plugins/helpers/subtask-ls'
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

describe('listSubtasksFromSessions', () => {
  const parentID = 'ses_parent'

  const session = (overrides: Record<string, unknown> = {}) => ({
    id: 'ses_1',
    title: 'do work',
    time: { created: 1000, updated: 2200 },
    outcome: 'succeeded',
    ...overrides,
  })

  const readerWith = (sessions: unknown[]) => ({
    list: vi.fn().mockResolvedValue(sessions),
    get: vi.fn(),
  })

  it('returns an empty array when the reader lists no sessions', async () => {
    const entries = await listSubtasksFromSessions(readerWith([]), parentID, {})

    expect(entries).toEqual([])
  })

  it('maps id, title, and epoch times to a step entry', async () => {
    const entries = await listSubtasksFromSessions(readerWith([session()]), parentID, {})

    expect(entries).toEqual([{ description: 'do work', durationMs: 1200, task_id: 'ses_1', status: 'ok' }])
  })

  it.each([
    { name: 'ok marker', title: '[ok] migrate db', expected: 'migrate db' },
    { name: 'error marker', title: '[error] migrate db', expected: 'migrate db' },
  ])('strips the $name prefix from the title', async ({ title, expected }) => {
    const entries = await listSubtasksFromSessions(readerWith([session({ title })]), parentID, {})

    expect(entries[0].description).toBe(expected)
  })

  it('truncates a long session title to a safe length', async () => {
    const longTitle = `x${'y'.repeat(200)}`
    const sessions = [session({ title: longTitle })]
    const entries = await listSubtasksFromSessions(readerWith(sessions), parentID, {})

    expect(entries[0].description.length).toBeLessThanOrEqual(80)
  })

  it.each([
    { name: 'succeeded', outcome: 'succeeded', expected: 'ok' },
    { name: 'failed', outcome: 'failed', expected: 'error' },
    { name: 'interrupted', outcome: 'interrupted', expected: 'error' },
  ])('maps outcome $name to status $expected', async ({ outcome, expected }) => {
    const entries = await listSubtasksFromSessions(readerWith([session({ outcome })]), parentID, {})

    expect(entries[0].status).toBe(expected)
  })

  it('maps an unsettled session to error with a live duration', async () => {
    const now = Date.now()
    const liveTime = { created: now - 500, updated: now - 500 }
    const sessions = [session({ outcome: undefined, time: liveTime })]
    const entries = await listSubtasksFromSessions(readerWith(sessions), parentID, {})

    expect(entries[0].status).toBe('error')
    expect(entries[0].durationMs).toBeGreaterThanOrEqual(0)
  })

  it('coerces ISO time strings to epoch milliseconds', async () => {
    const created = '2026-10-20T00:00:01.000Z'
    const updated = '2026-10-20T00:00:02.200Z'
    const sessions = [session({ time: { created, updated } })]
    const entries = await listSubtasksFromSessions(readerWith(sessions), parentID, {})
    const expected = Date.parse(updated) - Date.parse(created)

    expect(entries[0].durationMs).toBe(expected)
  })

  it('defaults to 10 rows and caps count at 50', async () => {
    const many = Array.from({ length: 60 }, (_, index) => session({ id: `ses_${index}`, title: `step ${index}` }))

    expect(await listSubtasksFromSessions(readerWith(many), parentID, {})).toHaveLength(10)
    expect(await listSubtasksFromSessions(readerWith(many), parentID, { count: 500 })).toHaveLength(50)
  })

  it('filters by status when requested', async () => {
    const sessions = [session({ id: 'ses_ok' }), session({ id: 'ses_bad', outcome: 'failed', title: '[error] bad' })]

    const entries = await listSubtasksFromSessions(readerWith(sessions), parentID, { status: 'error' })

    expect(entries.map(entry => entry.task_id)).toEqual(['ses_bad'])
  })

  it('falls back to get when list throws', async () => {
    const reader = {
      list: vi.fn().mockRejectedValue(new Error('boom')),
      get: vi.fn().mockResolvedValue(session({ id: 'ses_fallback' })),
    }

    const entries = await listSubtasksFromSessions(reader, parentID, {})

    expect(reader.get).toHaveBeenCalled()
    expect(entries.map(entry => entry.task_id)).toEqual(['ses_fallback'])
  })

  it('uses the get path when the reader has no list', async () => {
    const reader = { get: vi.fn().mockResolvedValue(session({ id: 'ses_direct' })) }

    const entries = await listSubtasksFromSessions(reader, parentID, {})

    expect(entries.map(entry => entry.task_id)).toEqual(['ses_direct'])
  })
})
