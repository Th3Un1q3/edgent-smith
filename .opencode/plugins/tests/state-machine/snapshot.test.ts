import { describe, expect, it } from 'vitest'

import { DEFAULT_SNAPSHOT } from '@plugins/state-machine/machines'
import {
  createSnapshotRecord,
  isExpired,
  parseSnapshotRecord,
  SNAPSHOT_TTL_MS,
  snapshotKey,
} from '@plugins/state-machine/core/snapshot'

import type { PersistedSnapshot, SnapshotRecord } from '@plugins/state-machine/core/snapshot'
import type { StoredSession } from '@plugins/state-machine/machines/session/context'

const NOW = Date.parse('2026-11-16T12:00:00.000Z')

const STATES: ReadonlySet<string> = new Set([
  'admission', 'towards_goal', 'towards_goal.define_goal', 'towards_goal.work',
  'towards_goal.check', 'towards_goal.validate', 'towards_goal.memorize',
  'parked', 'panic', 'free_work',
])

const contextFixture = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  sessionId: 'ses_1',
  goal: 'ship the snapshot',
  intent: 'none',
  attempts: 0,
  memories: ['a lesson'],
  improvements: [],
  injectedSkills: ['task-delegation'],
  injected: { 'preferences/user': { full: ['be brief'], index: ['tone'] } },
  results: {},
  ...overrides,
})

const snapshotFixture = (
  context: Partial<StoredSession> = {},
  value = 'towards_goal.work',
): PersistedSnapshot => ({
  status: 'active',
  value,
  context: contextFixture(context),
})

describe('snapshotKey', () => {
  it('namespaces one key per session', () => {
    expect(snapshotKey('ses_1')).toBe('state-machine/ses_1')
  })
})

describe('createSnapshotRecord', () => {
  it('stamps storedAt and a 30-day expiresAt', () => {
    const record = createSnapshotRecord(snapshotFixture(), NOW)

    expect(record.storedAt).toBe('2026-11-16T12:00:00.000Z')
    expect(record.expiresAt).toBe(new Date(NOW + SNAPSHOT_TTL_MS).toISOString())
    expect(SNAPSHOT_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })

  it('carries the session id and the persisted snapshot', () => {
    const record = createSnapshotRecord(snapshotFixture(), NOW)

    expect(record.v).toBe(2)
    expect(record.sessionId).toBe('ses_1')
    expect(record.snapshot.value).toBe('towards_goal.work')
    expect((record.snapshot.context as StoredSession).goal).toBe('ship the snapshot')
  })

  it('writes only the allowlisted context fields', () => {
    const withSecret = snapshotFixture({ apiKey: 'sk-live-secret' } as Partial<StoredSession>)
    const record = createSnapshotRecord(withSecret, NOW)
    const keys = Object.keys(record.snapshot.context as StoredSession)

    expect(keys).not.toContain('apiKey')
    expect(JSON.stringify(record)).not.toContain('sk-live-secret')
    expect(keys).toContain('policy')
  })
})

describe('isExpired', () => {
  const record = createSnapshotRecord(snapshotFixture(), NOW)

  it('is false before expiresAt', () => {
    expect(isExpired(record, NOW + SNAPSHOT_TTL_MS - 1)).toBe(false)
  })

  it('is true at and after expiresAt', () => {
    expect(isExpired(record, NOW + SNAPSHOT_TTL_MS)).toBe(true)
    expect(isExpired(record, NOW + SNAPSHOT_TTL_MS + 1)).toBe(true)
  })

  it('is true when expiresAt does not parse', () => {
    expect(isExpired({ ...record, expiresAt: 'not-a-date' }, NOW)).toBe(true)
  })
})

describe('parseSnapshotRecord', () => {
  const record = createSnapshotRecord(snapshotFixture(), NOW)

  it('round-trips the state and the context', () => {
    const parsed = parseSnapshotRecord(structuredClone(record), NOW, STATES)

    expect(typeof parsed).toBe('object')
    const restored = parsed as SnapshotRecord

    expect(restored.snapshot.value).toBe('towards_goal.work')
    expect((restored.snapshot.context as StoredSession).memories).toEqual(['a lesson'])
  })

  it('round-trips a stored result and skill injection', () => {
    const withResult = createSnapshotRecord(snapshotFixture({
      results: { check: { ok: true, exitCode: 0, output: 'done', value: { full: ['a'], index: ['b'] } } },
    }), NOW)
    const parsed = parseSnapshotRecord(structuredClone(withResult), NOW, STATES)

    expect(typeof parsed).toBe('object')
    const context = (parsed as SnapshotRecord).snapshot.context as StoredSession

    expect(context.results.check?.output).toBe('done')
    expect(context.injectedSkills).toEqual(['task-delegation'])
  })

  it('drops an unknown field on parse', () => {
    const parsed = parseSnapshotRecord({ ...record, extra: 'x' }, NOW, STATES)

    expect(typeof parsed).toBe('object')
    expect((parsed as { extra?: string }).extra).toBeUndefined()
  })

  it('reports expired past expiresAt', () => {
    expect(parseSnapshotRecord(record, NOW + SNAPSHOT_TTL_MS + 1, STATES)).toBe('expired')
  })

  it('reports shape-invalid for a non-object, a missing id and a broken envelope', () => {
    expect(parseSnapshotRecord('nope', NOW, STATES)).toBe('shape-invalid')
    expect(parseSnapshotRecord({ ...record, sessionId: undefined }, NOW, STATES)).toBe('shape-invalid')
    expect(parseSnapshotRecord({ ...record, expiresAt: 42 }, NOW, STATES)).toBe('shape-invalid')
    expect(parseSnapshotRecord({ ...record, v: 3 }, NOW, STATES)).toBe('shape-invalid')
  })

  it('reports shape-invalid when the snapshot or its context is not an object', () => {
    expect(parseSnapshotRecord({ ...record, snapshot: 'nope' }, NOW, STATES)).toBe('shape-invalid')
    expect(parseSnapshotRecord({ ...record, snapshot: { ...record.snapshot, context: 'nope' } }, NOW, STATES)).toBe('shape-invalid')
    expect(parseSnapshotRecord({ ...record, snapshot: { ...record.snapshot, status: undefined } }, NOW, STATES)).toBe('shape-invalid')
  })

  it('reports shape-invalid when the context and the envelope name different sessions', () => {
    expect(parseSnapshotRecord({ ...record, sessionId: 'ses_2' }, NOW, STATES)).toBe('shape-invalid')
    expect(parseSnapshotRecord(structuredClone(record), NOW, STATES, 'ses_2')).toBe('shape-invalid')
    expect(parseSnapshotRecord({
      ...record,
      snapshot: { ...record.snapshot, context: { ...(record.snapshot.context as StoredSession), sessionId: '' } },
    }, NOW, STATES)).toBe('shape-invalid')
  })

  it('reports a v1 record as legacy instead of reading it', () => {
    expect(parseSnapshotRecord({ ...record, v: 1, payload: record.snapshot.context }, NOW, STATES)).toBe('legacy')
    expect(parseSnapshotRecord({ sessionId: 'ses_1', payload: {} }, NOW, STATES)).toBe('legacy')
  })
})

describe('the snapshot codec', () => {
  it('keeps command output whole so a workflow can read it', () => {
    const long = 'x'.repeat(DEFAULT_SNAPSHOT.limit * 4)
    const bounded = DEFAULT_SNAPSHOT.bound({ ...contextFixture({ results: { quality_check_ready: { ok: true, output: long } } }) })

    expect((bounded.results as Record<string, { output?: string }>).quality_check_ready?.output).toBe(long)
  })

  it('keeps memory keys and injected values whole', () => {
    const many = Array.from({ length: 25 }, (_, index) => 'mem:' + index + ':complete')
    const bounded = DEFAULT_SNAPSHOT.bound({
      ...contextFixture({
        memories: many,
        injected: { 'preferences/user': { full: many, index: many } },
      }),
    })

    expect(bounded.memories).toEqual(many)
    expect((bounded.injected as Record<string, { full: readonly string[] }>)['preferences/user']?.full).toEqual(many)
  })

  it('caps the failure detail carried from a failed callback', () => {
    const long = 'y'.repeat(DEFAULT_SNAPSHOT.limit * 3)
    const bounded = DEFAULT_SNAPSHOT.bound({ ...contextFixture({ failure: { reason: 'quality_check_ready failed', detail: long } }) })

    expect(DEFAULT_SNAPSHOT.limit).toBe(1024)
    expect(((bounded.failure as { detail?: string }).detail ?? '').length).toBe(1024)
  })
})
