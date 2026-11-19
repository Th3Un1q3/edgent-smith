import { Exit, Option } from 'effect'

import { describe, expect, expectTypeOf, it } from 'vitest'

import { createStateMachine, LOOP_STATE_IDS, loadStateMachineLibrary, SESSION_LOOP } from '@plugins/state-machine/core/machine'
import { createSnapshotRecord, snapshotKey } from '@plugins/state-machine/core/snapshot'

import type { Actor, InterruptReason, LoopContext, LoopStateId, StateMachine } from '@plugins/state-machine/core/machine'
import type { SessionSnapshot } from '@plugins/state-machine/core/snapshot'

const NOW = Date.parse('2026-11-16T12:00:00.000Z')

const seeded = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  sessionId: 'ses_1',
  state: 'work',
  goal: 'old goal',
  intent: 'lesson',
  attempts: 2,
  idleCount: 1,
  memories: ['keep this lesson'],
  improvements: ['keep this improvement'],
  injectedSkills: ['task-delegation'],
  injected: { 'preferences/user': { full: ['be brief'], index: ['tone'] } },
  results: {},
  updatedAt: '2026-11-16T12:00:00.000Z',
  ...overrides,
})

import { makeHarness, register, sessionCreated } from '@tests/helpers/state-machine-harness'

import type { Harness } from '@tests/helpers/state-machine-harness'

const goalRequests = (harness: Harness): number =>
  harness.synthetics.filter(message => message.text.includes('What goal')).length

const lastState = (harness: Harness): string | undefined => {
  const writes = harness.storageWrites.filter(write => write.key === 'state-machine/ses_1')
  const last = writes.at(-1)?.value as { payload?: SessionSnapshot } | undefined
  return last?.payload?.state
}

const startInWork = async (): Promise<Harness> => {
  const harness = makeHarness()
  await register(harness)
  await harness.emit(sessionCreated('ses_1', 'rug'))
  await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } })
  return harness
}

describe('the loop matrix', () => {
  it('resets from parked and panic', () => {
    const target = (state: 'parked' | 'panic'): unknown =>
      (SESSION_LOOP.states[state].on as Record<string, { target?: string }>).system_user_input?.target

    expect(target('parked')).toBe('define_goal')
    expect(target('panic')).toBe('define_goal')
  })

  it('never resets from work, define_goal, check, validate or memorize', () => {
    const isHandled = (state: 'work' | 'define_goal' | 'check' | 'validate' | 'memorize'): boolean =>
      (SESSION_LOOP.states[state].on as Record<string, unknown>).system_user_input !== undefined

    expect(isHandled('work')).toBe(false)
    expect(isHandled('define_goal')).toBe(false)
    expect(isHandled('check')).toBe(false)
    expect(isHandled('validate')).toBe(false)
    expect(isHandled('memorize')).toBe(false)
  })
})

describe('a real user message', () => {
  it('leaves work alone, so a message mid-goal cannot wipe it', async () => {
    const harness = await startInWork()
    const before = goalRequests(harness)

    await harness.emitUserMessage('ses_1', 'user', 'new direction')

    expect(goalRequests(harness)).toBe(before)
    expect(lastState(harness)).toBe('work')
  })

  it('leaves parked on a follow-up message', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({ key: snapshotKey('ses_1'), value: createSnapshotRecord(seeded({ state: 'parked' }), NOW) })
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    await harness.emitUserMessage('ses_1', 'user', 'follow-up')

    const result = await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'follow-up' } })
    const content = Exit.isSuccess(result) ? (result.value as { content: string }).content : ''

    expect(content).toContain('Signal accepted.')
  })

  it('leaves parked when the first message after a reload arrives', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({ key: snapshotKey('ses_1'), value: createSnapshotRecord(seeded({ state: 'parked' }), NOW) })
    await register(harness)

    // A reloaded plugin has no machine in memory and receives only the message.
    await harness.emitUserMessage('ses_1', 'user', 'next task')

    const result = await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'next task' } })
    const content = Exit.isSuccess(result) ? (result.value as { content: string }).content : ''

    expect(content).toContain('Signal accepted.')
  })

  it('wakes a fresh session with the goal request on the first message', async () => {
    const harness = makeHarness()
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    expect(harness.synthetics).toHaveLength(0)

    await harness.emitUserMessage('ses_1', 'user', 'ship it')

    expect(goalRequests(harness)).toBe(1)
  })

  it('clears the round and keeps what was learned', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({ key: snapshotKey('ses_1'), value: createSnapshotRecord(seeded({ state: 'parked' }), NOW) })
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    await harness.emitUserMessage('ses_1', 'user', 'new direction')

    const writes = harness.storageWrites.filter(write => write.key === snapshotKey('ses_1'))
    const payload = (writes.at(-1)?.value as { payload: SessionSnapshot }).payload

    expect(payload.state).toBe('define_goal')
    expect(payload.goal).toBe('')
    expect(payload.intent).toBe('none')
    expect(payload.attempts).toBe(0)
    expect(payload.idleCount).toBe(0)
    expect(payload.memories).toEqual(['keep this lesson'])
    expect(payload.improvements).toEqual(['keep this improvement'])
    expect(payload.injectedSkills).toEqual(['task-delegation'])
  })

  it('persists the reset before the next call', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({ key: snapshotKey('ses_1'), value: createSnapshotRecord(seeded({ state: 'parked' }), NOW) })
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    await harness.emitUserMessage('ses_1', 'user', 'new direction')

    expect(lastState(harness)).toBe('define_goal')
    const result = await harness.runTool({ type: 'CLAIM_WORK' })

    if (Exit.isSuccess(result)) throw new Error('expected a refusal')

    const error = Exit.findErrorOption(result)

    if (Option.isNone(error)) throw new Error('expected a typed error')

    expect((error.value as { message: string }).message)
      .toContain('CLAIM_WORK is not available in define_goal')
  })

  it('ignores a synthetic item', async () => {
    const harness = await startInWork()
    const before = goalRequests(harness)

    await harness.emitUserMessage('ses_1', 'synthetic', 'plugin prompt')

    expect(goalRequests(harness)).toBe(before)
    expect(lastState(harness)).toBe('work')
  })

  it('ignores a compaction and a move item', async () => {
    const harness = await startInWork()

    await harness.emitUserMessage('ses_1', 'compaction', '')
    await harness.emitUserMessage('ses_1', 'move', '')

    expect(lastState(harness)).toBe('work')
  })

  it('is a no-op for a session whose agent is unmapped', async () => {
    const harness = makeHarness()
    harness.sessionAgents.set('ses_missing', 'unmapped-agent')
    await register(harness)

    await harness.emitUserMessage('ses_missing', 'user', 'hello')

    expect(harness.storageWrites).toHaveLength(0)
    expect(harness.synthetics).toHaveLength(0)
  })

  it('keeps the reset in memory when the snapshot write fails', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({ key: snapshotKey('ses_1'), value: createSnapshotRecord(seeded({ state: 'parked' }), NOW) })
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))
    harness.failStorageWrites = true

    await harness.emitUserMessage('ses_1', 'user', 'new direction')

    expect(goalRequests(harness)).toBeGreaterThan(0)
  })
})

const loopContext = (): LoopContext => ({
  sessionId: 'ses_actor',
  agent: 'rug',
  maxAttempts: 3,
  memoryLimit: 20,
  goal: 'ship it',
  intent: 'none',
  attempts: 0,
  idleCount: 0,
  memories: [],
  improvements: [],
  injectedSkills: [],
  injected: {},
  results: {},
})

const actorAt = async (state: LoopStateId): Promise<Actor> => {
  const library = await loadStateMachineLibrary()
  return library.createActor(SESSION_LOOP, state, loopContext())
}

const interrupt = (actor: Actor, reason: InterruptReason = 'user'): void => {
  actor.send({ type: 'system_interrupted', reason })
}

describe('an interruption', () => {
  it('carries the four reasons the host reports', () => {
    expectTypeOf<InterruptReason>().toEqualTypeOf<'user' | 'shutdown' | 'superseded' | 'inactivity'>()
  })

  it('parks work', async () => {
    const actor = await actorAt('work')
    actor.takeEmits()

    interrupt(actor)

    expect(actor.state()).toBe('parked')
  })

  it('parks validate', async () => {
    const actor = await actorAt('validate')
    actor.takeEmits()

    interrupt(actor, 'superseded')

    expect(actor.state()).toBe('parked')
  })

  it('parks panic, because taking control is not a failure', async () => {
    const actor = await actorAt('panic')

    interrupt(actor, 'shutdown')

    expect(actor.state()).toBe('parked')
  })

  it('leaves parked in parked and emits nothing', async () => {
    const actor = await actorAt('parked')
    actor.takeEmits()

    interrupt(actor, 'inactivity')

    expect(actor.state()).toBe('parked')
    expect(actor.takeEmits()).toEqual([])
  })

  it('is declared at the top level, not in any state', () => {
    const declared = LOOP_STATE_IDS.filter(state => 'system_interrupted' in SESSION_LOOP.states[state].on)

    expect(declared).toEqual([])
  })

  it('parks every state but parked through the one top-level arm', async () => {
    for (const state of LOOP_STATE_IDS) {
      const actor = await actorAt(state)
      actor.takeEmits()

      interrupt(actor)

      expect({ state, interrupted: actor.state() }).toEqual({ state, interrupted: 'parked' })
    }
  })

  it('parks a work session through the public entry point', async () => {
    const machine = await machineAt('work')

    const emits = machine.interrupted('ses_api', 'user')

    expect(machine.state('ses_api')).toBe('parked')
    expect(emits).toEqual([{
      type: 'emit.prompt',
      text: expect.stringContaining('Waiting for your next instruction'),
      description: 'Report the reached goal and the improvements recorded.',
    }])
  })

  it('returns no emits when the session is already parked', async () => {
    const machine = await machineAt('parked')

    expect(machine.interrupted('ses_api', 'shutdown')).toEqual([])
    expect(machine.state('ses_api')).toBe('parked')
  })
})

const machineAt = async (state: LoopStateId): Promise<StateMachine> => {
  const machine = createStateMachine({ library: await loadStateMachineLibrary(), startStateFor: () => state })
  machine.start('ses_api', 'rug')
  return machine
}
