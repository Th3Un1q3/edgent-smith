import { Effect, Exit } from 'effect'

import { describe, expect, it } from 'vitest'

import { createSnapshotRecord } from '@plugins/state-machine/core/snapshot'
import { createSnapshotStore, snapshotKey } from '@plugins/state-machine/core/snapshot'

import type { PersistedSnapshot, SnapshotRecord } from '@plugins/state-machine/core/snapshot'
import type { StoredSession } from '@plugins/state-machine/machines/session/context'

const NOW = Date.parse('2026-11-16T12:00:00.000Z')

const STATES: ReadonlySet<string> = new Set([
  'admission', 'towards_goal', 'towards_goal.define_goal', 'towards_goal.work',
  'towards_goal.check', 'towards_goal.validate', 'towards_goal.memorize',
  'towards_goal.parked', 'towards_goal.panic', 'free_work',
])

const contextFixture = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  sessionId: 'ses_1',
  goal: '',
  intent: 'none',
  attempts: 0,
  nudges: 0,
  memories: [],
  improvements: [],
  injectedSkills: [],
  injected: {},
  results: {},
  ...overrides,
})

const snapshotFixture = (
  context: Partial<StoredSession> = {},
  value = 'towards_goal.define_goal',
): PersistedSnapshot => ({
  status: 'active',
  value,
  context: contextFixture(context),
  children: {},
})

interface FakeStorage {
  readonly values: Map<string, unknown>
  readonly reads: string[]
  readonly writes: Array<{ key: string, value: unknown }>
  failReads: boolean
  failWrites: boolean
}

const statePathOf = (value: unknown): string =>
  typeof value === 'string' ? value : Object.entries(value as Record<string, unknown>).map(([id, child]) => id + '.' + statePathOf(child)).join('.')

const fakeStorage = (seed: Record<string, unknown> = {}): FakeStorage => ({
  values: new Map(Object.entries(seed)),
  reads: [],
  writes: [],
  failReads: false,
  failWrites: false,
})

const storeOver = (storage: FakeStorage) => createSnapshotStore({
  load: (key) => {
    storage.reads.push(key)
    return storage.failReads ? Effect.fail(new Error('read exploded')) : Effect.sync(() => storage.values.get(key))
  },
  save: (key, value) => storage.failWrites
    ? Effect.fail(new Error('write exploded'))
    : Effect.sync(() => {
        storage.values.set(key, value)
        storage.writes.push({ key, value })
      }),
  now: () => NOW,
})

describe('SnapshotStore.read', () => {
  it('reads only the session key and returns the present record', async () => {
    const snapshot = snapshotFixture({ goal: 'ship it' }, 'towards_goal.work')
    const storage = fakeStorage({ [snapshotKey('ses_1')]: createSnapshotRecord(snapshot, NOW) })
    const result = await Effect.runPromise(storeOver(storage).read('ses_1', STATES))

    expect(result.status).toBe('present')
    expect(storage.reads).toEqual(['state-machine/ses_1'])
  })

  it('returns absent for a missing key', async () => {
    const storage = fakeStorage()
    const result = await Effect.runPromise(storeOver(storage).read('ses_1', STATES))

    expect(result).toEqual({ status: 'absent', reason: 'missing' })
  })

  it('returns absent with the expired reason past expiry', async () => {
    const record = createSnapshotRecord(snapshotFixture(), NOW)
    const storage = fakeStorage({ [snapshotKey('ses_1')]: record })
    const store = createSnapshotStore({
      load: key => Effect.sync(() => storage.values.get(key)),
      save: () => Effect.void,
      now: () => NOW + 31 * 24 * 60 * 60 * 1000,
    })
    const result = await Effect.runPromise(store.read('ses_1', STATES))

    expect(result).toEqual({ status: 'absent', reason: 'expired' })
  })

  it('returns absent with the shape-invalid reason for a malformed value', async () => {
    const storage = fakeStorage({ [snapshotKey('ses_1')]: { v: 3 } })
    const result = await Effect.runPromise(storeOver(storage).read('ses_1', STATES))

    expect(result).toEqual({ status: 'absent', reason: 'shape-invalid' })
  })

  it('returns absent with the legacy reason for a v1 record', async () => {
    const storage = fakeStorage({
      [snapshotKey('ses_1')]: { sessionId: 'ses_1', v: 1, payload: { sessionId: 'ses_1' }, storedAt: '2026-11-16T12:00:00.000Z', expiresAt: '2026-12-16T12:00:00.000Z' },
    })
    const result = await Effect.runPromise(storeOver(storage).read('ses_1', STATES))

    expect(result).toEqual({ status: 'absent', reason: 'legacy' })
  })

  it('returns rejected when the load effect fails', async () => {
    const storage = fakeStorage()
    storage.failReads = true
    const result = await Effect.runPromise(storeOver(storage).read('ses_1', STATES))

    expect(result.status).toBe('rejected')
  })

  it('never reads a legacy goal key', async () => {
    const storage = fakeStorage({
      'goal/ses_1': { text: 'old goal', nudges: 0 },
      'goal-gate/ses_1': { blocked: false },
    })
    const result = await Effect.runPromise(storeOver(storage).read('ses_1', STATES))

    expect(result.status).toBe('absent')
    expect(storage.reads).toEqual(['state-machine/ses_1'])
  })
})

describe('SnapshotStore.write', () => {
  it('writes one bounded record under the session key', async () => {
    const storage = fakeStorage()
    const ok = await Effect.runPromise(storeOver(storage).write(snapshotFixture({}, 'towards_goal.work')))

    expect(ok).toBe(true)
    expect(storage.writes).toHaveLength(1)
    expect(storage.writes[0]?.key).toBe('state-machine/ses_1')
    expect(statePathOf((storage.writes[0]?.value as SnapshotRecord).snapshot.value)).toBe('towards_goal.work')
  })

  it('reports a rejected write and keeps the previous value', async () => {
    const existing = createSnapshotRecord(snapshotFixture(), NOW)
    const storage = fakeStorage({ [snapshotKey('ses_1')]: existing })
    storage.failWrites = true
    const ok = await Effect.runPromise(storeOver(storage).write(snapshotFixture({}, 'towards_goal.work')))

    expect(ok).toBe(false)
    expect(storage.values.get(snapshotKey('ses_1'))).toBe(existing)
  })

  it('never fails the caller when the write rejects', async () => {
    const storage = fakeStorage()
    storage.failWrites = true
    const exit = await Effect.runPromiseExit(storeOver(storage).write(snapshotFixture()))

    expect(Exit.isSuccess(exit)).toBe(true)
  })
})
