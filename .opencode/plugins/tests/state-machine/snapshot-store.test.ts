import { Effect, Exit } from 'effect'

import { describe, expect, it } from 'vitest'

import { createSnapshotRecord } from '@plugins/state-machine/core/snapshot'
import { createSnapshotStore, snapshotKey } from '@plugins/state-machine/core/snapshot'

import type { SessionSnapshot } from '@plugins/state-machine/core/snapshot'

const NOW = Date.parse('2026-11-16T12:00:00.000Z')

const snapshotFixture = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  sessionId: 'ses_1',
  state: 'define_goal',
  goal: '',
  intent: 'none',
  attempts: 0,
  idleCount: 0,
  memories: [],
  improvements: [],
  injectedSkills: [],
  injected: {},
  results: {},
  updatedAt: '2026-11-16T12:00:00.000Z',
  ...overrides,
})

interface FakeStorage {
  readonly values: Map<string, unknown>
  readonly reads: string[]
  readonly writes: Array<{ key: string, value: unknown }>
  failReads: boolean
  failWrites: boolean
}

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
    const snapshot = snapshotFixture({ state: 'work', goal: 'ship it' })
    const storage = fakeStorage({ [snapshotKey('ses_1')]: createSnapshotRecord(snapshot, NOW) })
    const result = await Effect.runPromise(storeOver(storage).read('ses_1'))

    expect(result.status).toBe('present')
    expect(storage.reads).toEqual(['state-machine/ses_1'])
  })

  it('returns absent for a missing key', async () => {
    const storage = fakeStorage()
    const result = await Effect.runPromise(storeOver(storage).read('ses_1'))

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
    const result = await Effect.runPromise(store.read('ses_1'))

    expect(result).toEqual({ status: 'absent', reason: 'expired' })
  })

  it('returns absent with the shape-invalid reason for a malformed value', async () => {
    const storage = fakeStorage({ [snapshotKey('ses_1')]: { nope: true } })
    const result = await Effect.runPromise(storeOver(storage).read('ses_1'))

    expect(result).toEqual({ status: 'absent', reason: 'shape-invalid' })
  })

  it('returns rejected when the load effect fails', async () => {
    const storage = fakeStorage()
    storage.failReads = true
    const result = await Effect.runPromise(storeOver(storage).read('ses_1'))

    expect(result.status).toBe('rejected')
  })

  it('never reads a legacy goal key', async () => {
    const storage = fakeStorage({
      'goal/ses_1': { text: 'old goal', nudges: 0 },
      'goal-gate/ses_1': { blocked: false },
    })
    const result = await Effect.runPromise(storeOver(storage).read('ses_1'))

    expect(result.status).toBe('absent')
    expect(storage.reads).toEqual(['state-machine/ses_1'])
  })
})

describe('SnapshotStore.write', () => {
  it('writes one bounded record under the session key', async () => {
    const storage = fakeStorage()
    const ok = await Effect.runPromise(storeOver(storage).write(snapshotFixture({ state: 'work' })))

    expect(ok).toBe(true)
    expect(storage.writes).toHaveLength(1)
    expect(storage.writes[0]?.key).toBe('state-machine/ses_1')
    expect((storage.writes[0]?.value as { payload: SessionSnapshot }).payload.state).toBe('work')
  })

  it('reports a rejected write and keeps the previous value', async () => {
    const existing = createSnapshotRecord(snapshotFixture({ state: 'define_goal' }), NOW)
    const storage = fakeStorage({ [snapshotKey('ses_1')]: existing })
    storage.failWrites = true
    const ok = await Effect.runPromise(storeOver(storage).write(snapshotFixture({ state: 'work' })))

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
