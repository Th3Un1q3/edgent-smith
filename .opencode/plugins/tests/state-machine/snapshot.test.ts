import { describe, expect, it } from 'vitest'

import {
  boundSnapshot,
  createSnapshotRecord,
  isExpired,
  OUTPUT_LIMIT,
  parseSnapshotRecord,
  SNAPSHOT_TTL_MS,
  snapshotKey,
} from '@plugins/state-machine/core/snapshot'

import type { SessionSnapshot, SnapshotRecord } from '@plugins/state-machine/core/snapshot'

const NOW = Date.parse('2026-11-16T12:00:00.000Z')

const snapshotFixture = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  sessionId: 'ses_1',
  state: 'work',
  goal: 'ship the snapshot',
  intent: 'none',
  attempts: 0,
  idleCount: 0,
  memories: ['a lesson'],
  improvements: [],
  injectedSkills: ['task-delegation'],
  injected: { 'preferences/user': { full: ['be brief'], index: ['tone'] } },
  results: {},
  updatedAt: '2026-11-16T12:00:00.000Z',
  ...overrides,
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

  it('carries the session id and the payload', () => {
    const record = createSnapshotRecord(snapshotFixture(), NOW)

    expect(record.sessionId).toBe('ses_1')
    expect(record.payload.state).toBe('work')
    expect(record.payload.goal).toBe('ship the snapshot')
  })

  it('writes only the allowlisted fields', () => {
    const withSecret = { ...snapshotFixture(), apiKey: 'sk-live-secret' } as unknown as SessionSnapshot
    const record = createSnapshotRecord(withSecret, NOW)
    const keys = Object.keys(record.payload)

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

  it('round-trips a valid record', () => {
    const parsed = parseSnapshotRecord(structuredClone(record), NOW)

    expect(typeof parsed).toBe('object')
    const restored = parsed as SnapshotRecord

    expect(restored.payload.state).toBe('work')
    expect(restored.payload.memories).toEqual(['a lesson'])
  })

  it('round-trips a stored result and skill injection', () => {
    const withResult = createSnapshotRecord(snapshotFixture({
      results: { check: { ok: true, exitCode: 0, output: 'done', value: { full: ['a'], index: ['b'] } } },
    }), NOW)
    const parsed = parseSnapshotRecord(structuredClone(withResult), NOW)

    expect(typeof parsed).toBe('object')
    expect((parsed as SnapshotRecord).payload.results.check?.output).toBe('done')
  })

  it('drops an unknown field on parse', () => {
    const parsed = parseSnapshotRecord({ ...record, extra: 'x' }, NOW)

    expect(typeof parsed).toBe('object')
    expect((parsed as { extra?: string }).extra).toBeUndefined()
  })

  it('reports expired past expiresAt', () => {
    expect(parseSnapshotRecord(record, NOW + SNAPSHOT_TTL_MS + 1)).toBe('expired')
  })

  it('reports shape-invalid for a non-object, a missing id, and an unknown state', () => {
    expect(parseSnapshotRecord('nope', NOW)).toBe('shape-invalid')
    expect(parseSnapshotRecord({ ...record, sessionId: undefined }, NOW)).toBe('shape-invalid')
    expect(parseSnapshotRecord({ ...record, payload: { ...record.payload, state: 'nowhere' } }, NOW)).toBe('shape-invalid')
  })

  it('reports shape-invalid when the payload is not an object', () => {
    expect(parseSnapshotRecord({ ...record, payload: 'nope' }, NOW)).toBe('shape-invalid')
  })

  it('reports shape-invalid for a malformed failure, policy or result payload', () => {
    expect(parseSnapshotRecord({ ...record, payload: { ...record.payload, failure: 'nope' } }, NOW)).toBe('shape-invalid')
    expect(parseSnapshotRecord({ ...record, payload: { ...record.payload, policy: { stateId: 'nowhere' } } }, NOW)).toBe('shape-invalid')
    expect(parseSnapshotRecord({
      ...record,
      payload: { ...record.payload, results: { check: { ok: 'yes' } } },
    }, NOW)).toBe('shape-invalid')
    expect(parseSnapshotRecord({
      ...record,
      payload: { ...record.payload, injected: { 'preferences/user': { full: 'nope' } } },
    }, NOW)).toBe('shape-invalid')
  })
})

describe('boundSnapshot', () => {
  it('keeps command output whole so a workflow can read it', () => {
    const long = 'x'.repeat(OUTPUT_LIMIT * 4)
    const bounded = boundSnapshot(snapshotFixture({ results: { quality_check_ready: { ok: true, output: long } } }))

    expect(bounded.results.quality_check_ready?.output).toBe(long)
  })

  it('keeps memory keys and injected values whole', () => {
    const many = Array.from({ length: 25 }, (_, index) => 'mem:' + index + ':complete')
    const bounded = boundSnapshot(snapshotFixture({
      memories: many,
      injected: { 'preferences/user': { full: many, index: many } },
    }))

    expect(bounded.memories).toEqual(many)
    expect(bounded.injected['preferences/user']?.full).toEqual(many)
  })

  it('caps the failure detail carried from a failed callback', () => {
    const long = 'y'.repeat(OUTPUT_LIMIT * 3)
    const bounded = boundSnapshot(snapshotFixture({ failure: { reason: 'quality_check_ready failed', detail: long } }))

    expect((bounded.failure?.detail ?? '').length).toBe(OUTPUT_LIMIT)
  })
})
