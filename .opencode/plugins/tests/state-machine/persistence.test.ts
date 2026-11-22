import { Effect, Logger } from 'effect'

import { describe, expect, it } from 'vitest'

import { createSnapshotRecord, snapshotKey } from '@plugins/state-machine/core/snapshot'
import { createSnapshotStore } from '@plugins/state-machine/core/snapshot'
import { createStateMachine, loadStateMachineLibrary } from '@plugins/state-machine/core/machine'

import type { PersistedSnapshot, SnapshotRecord, SnapshotStore } from '@plugins/state-machine/core/snapshot'
import type { StoredSession } from '@plugins/state-machine/machines/session/context'

import { makeHarness, register, sessionCreated } from '@tests/helpers/state-machine-harness'

import type { Harness } from '@tests/helpers/state-machine-harness'

const NOW = Date.parse('2026-11-16T12:00:00.000Z')

const contextFixture = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  sessionId: 'ses_1',
  goal: 'ship the snapshot',
  intent: 'none',
  attempts: 0,
  nudges: 0,
  memories: [],
  improvements: [],
  injectedSkills: [],
  injected: {},
  results: {},
  policy: { stateId: 'towards_goal.define_goal', errorMessage: 'Call SET_GOAL first.', allowedTools: ['signal_send'] },
  ...overrides,
})

const WORK_STATE = { towards_goal: 'work' } as const

const snapshotFixture = (
  context: Partial<StoredSession> = {},
  value: unknown = WORK_STATE,
): PersistedSnapshot => ({
  status: 'active',
  value,
  context: contextFixture(context),
  children: {},
})

const statePathOf = (value: unknown): string =>
  typeof value === 'string' ? value : Object.entries(value as Record<string, unknown>).map(([id, child]) => id + '.' + statePathOf(child)).join('.')

interface Stored {
  readonly writes: Array<{ key: string, value: unknown }>
  reads: number
  seed?: unknown
  failReads: boolean
  failWrites: boolean
}

const storeOver = (stored: Stored): SnapshotStore => createSnapshotStore({
  load: () => Effect.suspend(() => {
    stored.reads += 1
    return stored.failReads ? Effect.fail(new Error('read exploded')) : Effect.succeed(stored.seed)
  }),
  save: (key, value) => stored.failWrites
    ? Effect.fail(new Error('write refused'))
    : Effect.sync(() => {
        stored.writes.push({ key, value })
        stored.seed = value
      }),
  now: () => NOW,
})

const machineWith = async (stored: Stored) => {
  const library = await loadStateMachineLibrary()
  return createStateMachine({
    library,
    snapshot: storeOver(stored),
  })
}

const storedRecord = (overrides: Partial<StoredSession> = {}, value: unknown = WORK_STATE): Stored => ({
  writes: [],
  reads: 0,
  seed: createSnapshotRecord(snapshotFixture(overrides, value), NOW),
  failReads: false,
  failWrites: false,
})

describe('ensure — restore on first access', () => {
  it('restores the state, goal and policy from a valid record', async () => {
    const stored = storedRecord()
    const machine = await machineWith(stored)
    const started = await Effect.runPromise(machine.ensure('ses_1', 'rug'))

    expect(started?.created).toBe(true)
    expect(started?.emits).toEqual([])
    expect(machine.get('ses_1')?.state).toBe('work')
    expect(machine.get('ses_1')?.context.goal).toBe('ship the snapshot')
    expect(machine.get('ses_1')?.context.policy?.stateId).toBe('towards_goal.define_goal')
  })

  it('starts at the agent state for an absent record', async () => {
    const stored: Stored = { writes: [], reads: 0, failReads: false, failWrites: false }
    const machine = await machineWith(stored)
    await Effect.runPromise(machine.ensure('ses_1', 'rug'))

    expect(machine.get('ses_1')?.state).toBe('define_goal')
  })

  it('starts at the agent state for an expired record', async () => {
    const stored = storedRecord()
    stored.seed = createSnapshotRecord(snapshotFixture(), NOW - 31 * 24 * 60 * 60 * 1000)
    const machine = await machineWith(stored)
    await Effect.runPromise(machine.ensure('ses_1', 'rug'))

    expect(machine.get('ses_1')?.state).toBe('define_goal')
  })

  it('starts at the agent state for a malformed record', async () => {
    const stored = storedRecord()
    stored.seed = { nope: true }
    const machine = await machineWith(stored)
    await Effect.runPromise(machine.ensure('ses_1', 'rug'))

    expect(machine.get('ses_1')?.state).toBe('define_goal')
  })

  it('starts fresh for a v1 record and logs the legacy migration', async () => {
    const stored = storedRecord()
    stored.seed = { sessionId: 'ses_1', v: 1, payload: { sessionId: 'ses_1', state: 'towards_goal.work' }, storedAt: new Date(NOW).toISOString(), expiresAt: new Date(NOW + 60_000).toISOString() }
    const machine = await machineWith(stored)
    const logs: string[] = []
    const collect = Logger.make<unknown, void>(({ message }) => {
      logs.push(Array.isArray(message) ? message.map(String).join(' ') : String(message))
    })

    const started = await Effect.runPromise(Effect.withLogger(machine.ensure('ses_1', 'rug'), collect))

    expect(started?.snapshot).toBe('legacy')
    expect(machine.get('ses_1')?.state).toBe('define_goal')
    expect(logs.join('\n')).toContain('v1 record, starting fresh')
  })

  it('starts at the agent state instead of restoring a transient state', async () => {
    const stored = storedRecord({}, { towards_goal: 'check' })
    const machine = await machineWith(stored)
    const started = await Effect.runPromise(machine.ensure('ses_1', 'rug'))

    expect(started?.snapshot).toBe('shape-invalid')
    expect(machine.get('ses_1')?.state).toBe('define_goal')
  })

  it('creates no machine when the read rejects', async () => {
    const stored = storedRecord()
    stored.failReads = true
    const machine = await machineWith(stored)
    const started = await Effect.runPromise(machine.ensure('ses_1', 'rug'))

    expect(started).toBeUndefined()
    expect(machine.get('ses_1')).toBeUndefined()
  })

  it('reads storage once for concurrent first accesses', async () => {
    const stored = storedRecord()
    const machine = await machineWith(stored)

    await Effect.runPromise(Effect.all([
      machine.ensure('ses_1', 'rug'),
      machine.ensure('ses_1', 'rug'),
      machine.ensure('ses_1', 'rug'),
    ], { concurrency: 'unbounded' }))

    expect(stored.reads).toBe(1)
  })

  it('is a no-op for a session that already has a machine', async () => {
    const stored = storedRecord()
    const machine = await machineWith(stored)

    await Effect.runPromise(machine.ensure('ses_1', 'rug'))
    const again = await Effect.runPromise(machine.ensure('ses_1', 'rug'))

    expect(again?.created).toBe(false)
    expect(stored.reads).toBe(1)
  })
})

describe('persist — write on change', () => {
  it('writes the whole snapshot after a state change', async () => {
    const stored = storedRecord()
    const machine = await machineWith(stored)

    await Effect.runPromise(machine.ensure('ses_1', 'rug'))
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    await Effect.runPromise(machine.persist('ses_1'))

    const last = stored.writes.at(-1)
    expect(last?.key).toBe(snapshotKey('ses_1'))
    expect(statePathOf((last?.value as SnapshotRecord).snapshot.value)).toBe('towards_goal.work')
  })

  it('writes nothing when no machine exists', async () => {
    const stored: Stored = { writes: [], reads: 0, failReads: false, failWrites: false }
    const machine = await machineWith(stored)

    await Effect.runPromise(machine.persist('ses_1'))

    expect(stored.writes).toHaveLength(0)
  })

  it('reports a rejected write instead of swallowing it', async () => {
    const stored = storedRecord()
    const machine = await machineWith(stored)

    await Effect.runPromise(machine.ensure('ses_1', 'rug'))
    stored.failWrites = true
    const status = await Effect.runPromise(machine.persist('ses_1'))

    expect(status).toBe('write-failed')
  })
})

describe('plugin wiring', () => {
  const seed = (harness: Harness, overrides: Partial<StoredSession> = {}, value: unknown = WORK_STATE): void => {
    harness.storageWrites.push({
      key: snapshotKey('ses_1'),
      value: createSnapshotRecord(snapshotFixture(overrides, value), NOW),
    })
  }

  it('restores a session on start and keeps the restored state', async () => {
    const harness = makeHarness()
    // A record carries the policy and the signals policy of the state that saved it;
    // `work` has no tool policy but enables CLAIM_WORK.
    seed(harness, { policy: undefined, signalsPolicy: { names: ['CLAIM_WORK'] } })
    await register(harness)

    await harness.emit(sessionCreated('ses_1', 'rug'))

    expect(harness.synthetics).toHaveLength(0)
    const exit = await harness.runTool({ type: 'CLAIM_WORK' })

    expect(exit._tag).toBe('Success')
  })

  it('writes one snapshot after a signal', async () => {
    const harness = makeHarness()
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } })

    const written = harness.storageWrites.filter(write => write.key === snapshotKey('ses_1'))
    expect(written.length).toBeGreaterThan(0)
    expect(statePathOf((written.at(-1)?.value as SnapshotRecord).snapshot.value)).toBe('towards_goal.work')
  })

  it('records a failed skill injection as an outcome', async () => {
    const harness = makeHarness()
    harness.failSkillInjection = true
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } })

    const context = (harness.storageWrites.at(-1)?.value as SnapshotRecord | undefined)?.snapshot.context as StoredSession | undefined
    expect(context?.results.skill_ready?.ok).toBe(false)
  })

  it('records a failed memory read as an outcome', async () => {
    const harness = makeHarness()
    harness.failMemories = true
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.emitUserMessage('ses_1', 'user', 'ship it')

    const context = (harness.storageWrites.at(-1)?.value as SnapshotRecord | undefined)?.snapshot.context as StoredSession | undefined
    expect(context?.results.memories_ready?.ok).toBe(false)
  })

  it('logs write-failed when storage rejects the snapshot write', async () => {
    const harness = makeHarness()
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))
    harness.failStorageWrites = true

    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } })

    expect(harness.logs.join('\n')).toContain('write-failed')
  })

  it('starts a fresh session at the agent state and records it once a callback lands', async () => {
    const harness = makeHarness()
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.emitUserMessage('ses_1', 'user', 'ship it')

    const written = harness.storageWrites.filter(write => write.key === snapshotKey('ses_1'))
    expect(statePathOf((written.at(-1)?.value as SnapshotRecord).snapshot.value)).toBe('towards_goal.define_goal')
    expect(harness.synthetics[0]?.text).toContain('What goal')
  })

  it('reports the tool a Code Mode call runs in execute.before', async () => {
    const harness = makeHarness()
    await register(harness)

    const hook = harness.toolHooks.get('execute.before')
    expect(hook).toBeDefined()

    const logs: string[] = []
    const collect = Logger.make<unknown, void>(({ message }) => {
      logs.push(Array.isArray(message) ? message.map(String).join(' ') : String(message))
    })

    await Effect.runPromise(Effect.withLogger(
      hook?.({ tool: 'bash', input: { command: 'echo hi' } }) ?? Effect.void,
      collect,
    ))

    expect(logs.join('\n')).toContain('execute.before tool=bash keys=command')
  })
})
