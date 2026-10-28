import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { listSubtasksFromSessions } from '@plugins/helpers/subtask-ls'

const NOW = 10_000

describe('listSubtasksFromSessions', () => {
  const parentID = 'ses_parent'

  const session = (overrides: Record<string, unknown> = {}) => ({
    id: 'ses_1',
    title: 'do work',
    time: { created: 1000, updated: 2200 },
    outcome: 'succeeded',
    ...overrides,
  })

  const readerWith = (response: unknown) => ({
    list: vi.fn().mockResolvedValue(response),
    get: vi.fn(),
  })

  const listWith = (response: unknown, options: { count?: number, status?: 'ok' | 'error' } = {}) =>
    listSubtasksFromSessions(readerWith(response), parentID, options)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns an empty array when the reader lists no sessions', async () => {
    const entries = await listWith([])

    expect(entries).toEqual([])
  })

  it('maps id, title, and epoch times to a step entry', async () => {
    const entries = await listWith([session()])

    expect(entries).toEqual([{ description: 'do work', durationMs: 1200, task_id: 'ses_1', status: 'ok' }])
  })

  describe('description', () => {
    it.each([
      { name: 'lowercase ok', title: '[ok] migrate db', expected: 'migrate db' },
      { name: 'uppercase ok', title: '[OK] migrate db', expected: 'migrate db' },
      { name: 'error', title: '[error] migrate db', expected: 'migrate db' },
      { name: 'padded error', title: '[error]    migrate db', expected: 'migrate db' },
      { name: 'bare error', title: '[error]', expected: '' },
      { name: 'inner marker', title: 'note [ok] migrate', expected: 'note [ok] migrate' },
    ])('strips the $name status marker', async ({ title, expected }) => {
      const entries = await listWith([session({ title })])

      expect(entries[0].description).toBe(expected)
    })

    it('truncates a long session title to a safe length', async () => {
      const entries = await listWith([session({ title: `x${'y'.repeat(200)}` })])

      expect(entries[0].description.length).toBeLessThanOrEqual(80)
    })

    it('empties a non-string id and title', async () => {
      const entries = await listWith([{ id: 42, title: 42, outcome: 'succeeded' }])

      expect(entries[0]).toMatchObject({ description: '', task_id: '' })
    })
  })

  describe('status', () => {
    it.each([
      { name: 'succeeded', outcome: 'succeeded', expected: 'ok' },
      { name: 'failed', outcome: 'failed', expected: 'error' },
      { name: 'interrupted', outcome: 'interrupted', expected: 'error' },
      { name: 'cancelled', outcome: 'cancelled', expected: 'error' },
    ])('maps outcome $name to $expected', async ({ outcome, expected }) => {
      const entries = await listWith([session({ outcome })])

      expect(entries[0].status).toBe(expected)
    })

    it.each([
      { name: 'a running outcome', outcome: 'running' },
      { name: 'a zero outcome', outcome: 0 },
      { name: 'a numeric outcome', outcome: 1 },
      { name: 'an absent outcome', outcome: undefined },
    ])('treats $name as unsettled and keeps the live duration', async ({ outcome }) => {
      const entries = await listWith([session({ outcome, time: { created: NOW - 500, updated: NOW - 200 } })])

      expect(entries[0]).toMatchObject({ durationMs: 500, status: 'error' })
    })
  })

  describe('durationMs', () => {
    it.each(['succeeded', 'failed', 'interrupted'])('uses updated minus created for the settled outcome %s', async (outcome) => {
      const entries = await listWith([session({ outcome, time: { created: 1000, updated: 2200 } })])

      expect(entries[0].durationMs).toBe(1200)
    })

    it('uses now minus created for a running entry', async () => {
      const entries = await listWith([session({ outcome: 'running', time: { created: NOW - 700, updated: NOW - 100 } })])

      expect(entries[0].durationMs).toBe(700)
    })

    it.each([
      { name: 'updated precedes created', outcome: 'succeeded', time: { created: 2200, updated: 1000 } },
      { name: 'created is in the future', outcome: 'running', time: { created: NOW + 500, updated: NOW + 800 } },
    ])('clamps to 0 when $name', async ({ outcome, time }) => {
      const entries = await listWith([session({ outcome, time })])

      expect(entries[0].durationMs).toBe(0)
    })

    it.each([
      { name: 'no time block', entry: { id: 'ses_1', title: 'x', outcome: 'succeeded' } },
      { name: 'an empty time block', entry: { id: 'ses_1', title: 'x', outcome: 'succeeded', time: {} } },
      { name: 'a missing updated', entry: { id: 'ses_1', title: 'x', outcome: 'succeeded', time: { created: 1000 } } },
      { name: 'a missing created', entry: { id: 'ses_1', title: 'x', outcome: 'succeeded', time: { updated: 2200 } } },
    ])('reports 0 for a settled entry with $name', async ({ entry }) => {
      const entries = await listWith([entry])

      expect(entries[0].durationMs).toBe(0)
    })

    it('reports 0 for a running entry without created', async () => {
      const entries = await listWith([{ id: 'ses_1', title: 'x', outcome: 'running', time: { updated: 2200 } }])

      expect(entries[0].durationMs).toBe(0)
    })
  })

  describe('timestamp coercion', () => {
    it.each([
      { name: 'a NaN created', time: { created: NaN, updated: 2200 } },
      { name: 'an Infinity updated', time: { created: 1000, updated: Infinity } },
      { name: 'an invalid Date created', time: { created: new Date('not a date'), updated: 2200 } },
    ])('ignores $name', async ({ time }) => {
      const entries = await listWith([session({ time })])

      expect(entries[0].durationMs).toBe(0)
    })

    it('accepts Date instances as timestamps', async () => {
      const entries = await listWith([session({ time: { created: new Date(1000), updated: new Date(2200) } })])

      expect(entries[0].durationMs).toBe(1200)
    })

    it('coerces ISO time strings to epoch milliseconds', async () => {
      const created = '2026-10-20T00:00:01.000Z'
      const updated = '2026-10-20T00:00:02.200Z'
      const entries = await listWith([session({ time: { created, updated } })])

      expect(entries[0].durationMs).toBe(Date.parse(updated) - Date.parse(created))
    })
  })

  describe('session reader shapes', () => {
    const child = () => [{ id: 'ses_shape', title: 'do work', outcome: 'succeeded', time: { created: 1000, updated: 2200 } }]

    it.each([
      { name: 'a bare array', response: child() },
      { name: 'a data array', response: { data: child() } },
      { name: 'a data object', response: { data: { id: 'ses_shape' } } },
      { name: 'a bare object', response: { id: 'ses_shape' } },
    ])('reads children from $name', async ({ response }) => {
      const entries = await listWith(response)

      expect(entries.map(entry => entry.task_id)).toEqual(['ses_shape'])
    })

    it('resolves an Effect-wrapped session array', async () => {
      const reader = { list: vi.fn(() => Effect.succeed(child())), get: vi.fn() }

      const entries = await listSubtasksFromSessions(reader, parentID, {})

      expect(entries.map(entry => entry.task_id)).toEqual(['ses_shape'])
    })

    it('resolves a native Promise', async () => {
      const reader = { list: vi.fn(() => Promise.resolve(child())), get: vi.fn() }

      const entries = await listSubtasksFromSessions(reader, parentID, {})

      expect(entries.map(entry => entry.task_id)).toEqual(['ses_shape'])
    })

    it('falls back to the session get when list rejects', async () => {
      const reader = { list: vi.fn(() => Promise.reject(new Error('list failed'))), get: vi.fn(() => Promise.resolve(child())) }

      const entries = await listSubtasksFromSessions(reader, parentID, {})

      expect(entries.map(entry => entry.task_id)).toEqual(['ses_shape'])
    })

    it('returns no entries when list resolves a primitive', async () => {
      const reader = { list: vi.fn(() => 42), get: vi.fn() }

      const entries = await listSubtasksFromSessions(reader, parentID, {})

      expect(entries).toEqual([])
    })

    it.each([
      { name: 'an empty object', response: {} },
      { name: 'an object without a data array', response: { data: {} } },
    ])('returns no entries when list returns $name synchronously', async ({ response }) => {
      const reader = { list: vi.fn(() => response), get: vi.fn() }

      const entries = await listSubtasksFromSessions(reader, parentID, {})

      expect(entries).toEqual([])
      expect(reader.get).not.toHaveBeenCalled()
    })

    it.each([
      { name: 'null', response: null },
      { name: 'undefined', response: undefined },
    ])('returns no entries and keeps the get path when list returns $name synchronously', async ({ response }) => {
      const reader = { list: vi.fn(() => response), get: vi.fn() }

      await expect(listSubtasksFromSessions(reader, parentID, {})).resolves.toEqual([])
      expect(reader.get).not.toHaveBeenCalled()
    })

    it.each([
      { name: 'null', response: null },
      { name: 'a string', response: 'ses_shape' },
      { name: 'a number', response: 42 },
      { name: 'an empty object', response: {} },
      { name: 'an empty array', response: [] },
      { name: 'a null data', response: { data: null } },
      { name: 'a non-string bare id', response: { id: 42 } },
      { name: 'a non-string data id', response: { data: { id: 42 } } },
    ])('returns no entries for $name', async ({ response }) => {
      const reader = readerWith(response)

      const entries = await listSubtasksFromSessions(reader, parentID, {})

      expect(entries).toEqual([])
      expect(reader.get).not.toHaveBeenCalled()
    })
  })

  it('requests the parent children and slices them in reader order', async () => {
    const reader = readerWith([session({ id: 'ses_a' }), session({ id: 'ses_b' }), session({ id: 'ses_c' })])

    const entries = await listSubtasksFromSessions(reader, parentID, { count: 2 })

    expect(reader.list).toHaveBeenCalledWith({ parentID })
    expect(reader.get).not.toHaveBeenCalled()
    expect(entries.map(entry => entry.task_id)).toEqual(['ses_a', 'ses_b'])
  })

  it('defaults to 10 rows and caps count at 50', async () => {
    const many = Array.from({ length: 60 }, (_, index) => session({ id: `ses_${index}`, title: `step ${index}` }))

    expect(await listWith(many)).toHaveLength(10)
    expect(await listWith(many, { count: 500 })).toHaveLength(50)
  })

  it('filters by status when requested', async () => {
    const entries = await listWith(
      [session({ id: 'ses_ok' }), session({ id: 'ses_bad', outcome: 'failed', title: '[error] bad' })],
      { status: 'error' },
    )

    expect(entries.map(entry => entry.task_id)).toEqual(['ses_bad'])
  })

  it('falls back to get with the parent session id when list throws', async () => {
    const reader = {
      list: vi.fn().mockRejectedValue(new Error('boom')),
      get: vi.fn().mockResolvedValue({ data: { id: 'ses_fallback' } }),
    }

    const entries = await listSubtasksFromSessions(reader, parentID, {})

    expect(reader.get).toHaveBeenCalledWith({ sessionID: parentID })
    expect(entries.map(entry => entry.task_id)).toEqual(['ses_fallback'])
  })

  it('returns no entries when list throws and the reader has no get', async () => {
    const reader = { list: vi.fn().mockRejectedValue(new Error('boom')) }

    const entries = await listSubtasksFromSessions(reader, parentID, {})

    expect(entries).toEqual([])
  })

  it('uses the get path when the reader has no list', async () => {
    const reader = { get: vi.fn().mockResolvedValue({ id: 'ses_direct' }) }

    const entries = await listSubtasksFromSessions(reader, parentID, {})

    expect(reader.get).toHaveBeenCalledWith({ sessionID: parentID })
    expect(entries.map(entry => entry.task_id)).toEqual(['ses_direct'])
  })
})
