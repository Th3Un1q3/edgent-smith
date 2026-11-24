import { Effect } from 'effect'

import { describe, expect, it } from 'vitest'

import { createSnapshotRecord, createSnapshotStore } from '@plugins/state-machine/core/snapshot'
import { createStateMachine, loadStateMachineLibrary } from '@plugins/state-machine/core/machine'

import type { SnapshotRecord, SnapshotStore } from '@plugins/state-machine/core/snapshot'

const NOW = Date.parse('2026-11-16T12:00:00.000Z')

const WORK_STATE = { towards_goal: 'work' } as const

interface Stored {
  reads: number
  seed?: unknown
  isReadFailing: boolean
}

const storeOver = (stored: Stored): SnapshotStore => createSnapshotStore({
  load: () => Effect.suspend(() => {
    stored.reads += 1
    return stored.isReadFailing ? Effect.fail(new Error('read exploded')) : Effect.succeed(stored.seed)
  }),
  save: (key, value) => Effect.sync(() => {
    stored.seed = { key, value }
  }),
  now: () => NOW,
})

const storedRecord = (isReadFailing = false): Stored => {
  const record: SnapshotRecord = createSnapshotRecord({
    status: 'active',
    value: WORK_STATE,
    context: {
      sessionId: 'ses_1',
      goal: 'ship the accessor',
      intent: 'none',
      attempts: 0,
      nudges: 0,
      memories: [],
      improvements: [],
      injectedSkills: [],
      injected: {},
      results: {},
      policy: { stateId: 'towards_goal.define_goal', errorMessage: 'Call SET_GOAL first.', allowedTools: ['signal_send'] },
    },
    children: {},
  }, NOW)

  return { reads: 0, seed: record, isReadFailing }
}

const machineWith = async (stored: Stored) => {
  const library = await loadStateMachineLibrary()

  return createStateMachine({ library, snapshot: storeOver(stored) })
}

describe('access — attach or fail', () => {
  it('restores a live handle at the stored leaf and attaches the entry', async () => {
    const stored = storedRecord()
    const machine = await machineWith(stored)

    const handle = await Effect.runPromise(machine.access('ses_1', { agent: 'rug' }))

    expect(handle.state).toBe('work')
    expect(handle.machine.context.goal).toBe('ship the accessor')

    const again = await Effect.runPromise(machine.access('ses_1', { agent: 'rug' }))

    expect(again.state).toBe('work')
    expect(stored.reads).toBe(1)

    const emits = await Effect.runPromise(handle.idle())

    expect(emits.length).toBeGreaterThan(0)
  })

  it('fails with no-identity and creates nothing when no entry exists', async () => {
    const stored = storedRecord()
    const machine = await machineWith(stored)

    const failure = await Effect.runPromise(Effect.flip(machine.access('ses_1', undefined)))

    expect(failure).toMatchObject({ sessionId: 'ses_1', reason: 'no-identity' })
    expect(stored.reads).toBe(0)
    expect(machine.get('ses_1')).toBeUndefined()
  })

  it('fails with read-failed and the store reason when the read rejects', async () => {
    const stored = storedRecord(true)
    const machine = await machineWith(stored)

    const failure = await Effect.runPromise(Effect.flip(machine.access('ses_1', { agent: 'rug' })))

    expect(failure).toMatchObject({ sessionId: 'ses_1', reason: 'read-failed', detail: 'read-failed:Error' })
    expect(machine.get('ses_1')).toBeUndefined()
  })
})
