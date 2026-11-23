import { Exit, Option } from 'effect'

import { describe, expect, expectTypeOf, it } from 'vitest'

import { createStateMachine, loadStateMachineLibrary, SESSION_LOOP } from '@plugins/state-machine/core/machine'
import { createSnapshotRecord, snapshotKey } from '@plugins/state-machine/core/snapshot'

import type { Actor, InterruptReason, LoopContext, LoopDefinition, LoopState, LoopStateId, StateMachine } from '@plugins/state-machine/core/machine'
import type { PersistedSnapshot, SnapshotRecord } from '@plugins/state-machine/core/snapshot'
import type { StoredSession } from '@plugins/state-machine/machines/session/context'

const NOW = Date.parse('2026-11-16T12:00:00.000Z')

const contextFixture = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  sessionId: 'ses_1',
  goal: 'old goal',
  intent: 'lesson',
  attempts: 2,
  nudges: 0,
  memories: ['keep this lesson'],
  improvements: ['keep this improvement'],
  injectedSkills: ['task-delegation'],
  injected: { 'preferences/user': { full: ['be brief'], index: ['tone'] } },
  results: {},
  ...overrides,
})

const seeded = (context: Partial<StoredSession> = {}, value: unknown = 'towards_goal.work'): PersistedSnapshot => ({
  status: 'active',
  value,
  context: contextFixture(context),
  children: {},
})

import { makeHarness, register, sessionCreated } from '@tests/helpers/state-machine/harness'
import { templateRendered, templateText } from '@tests/helpers/state-machine/template-text'

import type { Harness } from '@tests/helpers/state-machine/harness'

const statePathOf = (value: unknown): string =>
  typeof value === 'string' ? value : Object.entries(value as Record<string, unknown>).map(([id, child]) => id + '.' + statePathOf(child)).join('.')

const goalRequests = (harness: Harness): number =>
  harness.synthetics.filter(message => message.text.includes(templateText('goal_request'))).length

const lastState = (harness: Harness): string | undefined => {
  const writes = harness.storageWrites.filter(write => write.key === 'state-machine/ses_1')
  const last = writes.at(-1)?.value as SnapshotRecord | undefined

  return last === undefined ? undefined : statePathOf(last.snapshot.value)
}

const goalState = (id: string): LoopState =>
  (SESSION_LOOP.states.towards_goal.states as unknown as Record<string, LoopState>)[id]

interface Arm {
  readonly target?: string
  readonly actions?: readonly { readonly type: string, readonly params?: { readonly key?: string } }[]
}

const armTarget = (arm: Arm | undefined): string | undefined => arm?.target

const armActionTypes = (arm: Arm | undefined): string[] | undefined => arm?.actions?.map(action => action.type)

const armActionKeys = (arm: Arm | undefined): (string | undefined)[] | undefined =>
  arm?.actions?.map(action => action.params?.key)

const startInWork = async (): Promise<Harness> => {
  const harness = makeHarness()
  await register(harness)
  await harness.emit(sessionCreated('ses_1', 'rug'))
  await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } })
  return harness
}

describe('the loop matrix', () => {
  it('resets from parked and panic through one parent arm', () => {
    const arm = (state: 'parked' | 'panic'): Arm | undefined =>
      (goalState(state).on as unknown as Record<string, Arm>).system_user_input
    const parent = SESSION_LOOP.states.towards_goal.on as unknown as Record<string, Arm>

    expect(armTarget(arm('parked'))).toBeUndefined()
    expect(armActionTypes(arm('parked'))).toEqual(['emit_parent'])
    expect(armTarget(arm('panic'))).toBeUndefined()
    expect(armActionTypes(arm('panic'))).toEqual(['emit_parent'])
    expect(armTarget(parent.reset_goal)).toBe('#session.towards_goal.define_goal')
    expect(armActionKeys(parent.reset_goal))
      .toEqual(['goal', 'intent', 'attempts', 'nudges'])
  })

  it('never resets from work, define_goal, check, validate or memorize', () => {
    const isHandled = (state: 'work' | 'define_goal' | 'check' | 'validate' | 'memorize'): boolean =>
      (goalState(state).on as Record<string, unknown>).system_user_input !== undefined

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

    await harness.emitUserMessage('ses_1', 'user', 'new direction')

    expect(goalRequests(harness)).toBe(0)
    expect(lastState(harness)).toBe('towards_goal.work')
  })

  it('leaves parked on a follow-up message', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({ key: snapshotKey('ses_1'), value: createSnapshotRecord(seeded({}, { towards_goal: 'parked' }), NOW) })
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    await harness.emitUserMessage('ses_1', 'user', 'follow-up')

    const result = await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'follow-up' } })
    const content = Exit.isSuccess(result) ? (result.value as { content: string }).content : ''

    expect(content).toContain('Signal accepted.')
  })

  it('leaves parked when the first message after a reload arrives', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({ key: snapshotKey('ses_1'), value: createSnapshotRecord(seeded({}, { towards_goal: 'parked' }), NOW) })
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
    harness.storageWrites.push({ key: snapshotKey('ses_1'), value: createSnapshotRecord(seeded({}, { towards_goal: 'parked' }), NOW) })
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    await harness.emitUserMessage('ses_1', 'user', 'new direction')

    const writes = harness.storageWrites.filter(write => write.key === snapshotKey('ses_1'))
    const record = writes.at(-1)?.value as SnapshotRecord
    const context = record.snapshot.context as StoredSession

    expect(statePathOf(record.snapshot.value)).toBe('towards_goal.define_goal')
    expect(context.goal).toBe('')
    expect(context.intent).toBe('none')
    expect(context.attempts).toBe(0)
    expect(context.memories).toEqual(['keep this lesson'])
    expect(context.improvements).toEqual(['keep this improvement'])
    expect(context.injectedSkills).toEqual(['task-delegation'])
  })

  it('persists the reset before the next call', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({ key: snapshotKey('ses_1'), value: createSnapshotRecord(seeded({}, { towards_goal: 'parked' }), NOW) })
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    await harness.emitUserMessage('ses_1', 'user', 'new direction')

    expect(lastState(harness)).toBe('towards_goal.define_goal')
    const result = await harness.runTool({ type: 'CLAIM_WORK' })

    if (Exit.isSuccess(result)) throw new Error('expected a refusal')

    const error = Exit.findErrorOption(result)

    if (Option.isNone(error)) throw new Error('expected a typed error')

    expect((error.value as { message: string }).message)
      .toContain('CLAIM_WORK is not available in define_goal')
  })

  it('ignores a synthetic item', async () => {
    const harness = await startInWork()

    await harness.emitUserMessage('ses_1', 'synthetic', 'plugin prompt')

    expect(goalRequests(harness)).toBe(0)
    expect(lastState(harness)).toBe('towards_goal.work')
  })

  it('ignores a compaction and a move item', async () => {
    const harness = await startInWork()

    await harness.emitUserMessage('ses_1', 'compaction', '')
    await harness.emitUserMessage('ses_1', 'move', '')

    expect(lastState(harness)).toBe('towards_goal.work')
  })

  it('admits an unmapped agent to free_work and leaves it there', async () => {
    const harness = makeHarness()
    harness.sessionAgents.set('ses_missing', 'unmapped-agent')
    await register(harness)

    await harness.emitUserMessage('ses_missing', 'user', 'hello')

    expect(harness.synthetics).toHaveLength(0)
    const result = await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_missing', 'unmapped-agent')
    const error = Exit.isSuccess(result) ? Option.none() : Exit.findErrorOption(result)

    expect(Option.isSome(error) && (error.value as { message: string }).message)
      .toContain('CLAIM_WORK is not available in free_work')
  })

  it('keeps the reset in memory when the snapshot write fails', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({ key: snapshotKey('ses_1'), value: createSnapshotRecord(seeded({}, { towards_goal: 'parked' }), NOW) })
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))
    harness.failStorageWrites = true

    await harness.emitUserMessage('ses_1', 'user', 'new direction')

    expect(goalRequests(harness)).toBeGreaterThan(0)
  })
})

const loopContext = (): LoopContext => ({
  nudges: 0,
  sessionId: 'ses_actor',
  agent: 'rug',
  maxAttempts: 3,
  memoryLimit: 20,
  goal: 'ship it',
  intent: 'none',
  attempts: 0,
  memories: [],
  improvements: [],
  injectedSkills: [],
  injected: {},
  results: {},
})

const actorAt = async (state: LoopStateId): Promise<Actor> => {
  const library = await loadStateMachineLibrary()
  const [head, leaf] = state.split('.') as [LoopStateId, string | undefined]
  const loop: LoopDefinition = {
    ...SESSION_LOOP,
    states: { ...SESSION_LOOP.states, towards_goal: { ...SESSION_LOOP.states.towards_goal, initial: leaf ?? head } },
  }

  return library.createActor(loop, 'towards_goal', loopContext())
}

const interrupt = (actor: Actor, reason: InterruptReason = 'user'): void => {
  actor.send({ type: 'system_interrupted', reason })
}

describe('an interruption', () => {
  it('carries the four reasons the host reports', () => {
    expectTypeOf<InterruptReason>().toEqualTypeOf<'user' | 'shutdown' | 'superseded' | 'inactivity'>()
  })

  it('parks work', async () => {
    const actor = await actorAt('towards_goal.work')
    actor.takeEmits()

    interrupt(actor)

    expect(actor.state()).toBe('parked')
  })

  it('parks validate', async () => {
    const actor = await actorAt('towards_goal.validate')
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

  it('is declared on the machine root, not in any leaf', () => {
    expect(SESSION_LOOP.on?.system_interrupted)
      .toMatchObject({ target: '#session.towards_goal.parked', guard: { type: 'not_parked' } })
    expect(Object.keys(SESSION_LOOP.states.towards_goal.on)).toEqual(['system_idle', 'reset_goal'])

    for (const id of ['define_goal', 'work', 'check', 'validate', 'memorize']) {
      expect('system_interrupted' in goalState(id).on).toBe(false)
    }
  })

  it('parks every state but parked through the one top-level arm', async () => {
    for (const state of ['towards_goal.define_goal', 'towards_goal.work', 'towards_goal.check', 'towards_goal.validate', 'towards_goal.memorize', 'panic']) {
      const actor = await actorAt(state)
      actor.takeEmits()

      interrupt(actor)

      expect({ state, interrupted: actor.state() }).toEqual({ state, interrupted: 'parked' })
    }
  })

  it('parks a work session through the public entry point', async () => {
    const machine = await machineAt('towards_goal.work')

    const emits = machine.interrupted('ses_api', 'user')

    expect(machine.state('ses_api')).toBe('parked')
    expect(emits).toEqual([{
      type: 'emit.prompt',
      text: expect.stringContaining(templateRendered('park_summary', { goal: 'ship it.', improvements: 'none.' })),
      description: 'Report the reached goal and the improvements recorded.',
    }, {
      type: 'emit.signals',
      signal_keys: [],
    }])
  })

  it('returns no emits when the session is already parked', async () => {
    const machine = await machineAt('parked')

    expect(machine.interrupted('ses_api', 'shutdown')).toEqual([])
    expect(machine.state('ses_api')).toBe('parked')
  })
})

const machineAt = async (state: LoopStateId): Promise<StateMachine> => {
  const machine = createStateMachine({ library: await loadStateMachineLibrary() })
  machine.start('ses_api', 'rug')

  if (state === 'towards_goal.work') machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_api')
  else machine.interrupted('ses_api', 'user')

  return machine
}

describe('the parent raise', () => {
  it('answers one user message in parked inside the same send', async () => {
    const actor = await actorAt('parked')

    actor.takeEmits()
    actor.send({ type: 'system_user_input', text: 'next goal' })
    const emits = actor.takeEmits()

    expect(actor.statePath?.()).toBe('towards_goal.define_goal')
    expect(emits.filter(emit => emit.type === 'emit.prompt')).toHaveLength(1)
  })

  it('drops a raised type that no ancestor declares', async () => {
    const library = await loadStateMachineLibrary()
    const work = goalState('work')
    const custom: LoopDefinition = {
      ...SESSION_LOOP,
      states: {
        ...SESSION_LOOP.states,
        towards_goal: {
          ...SESSION_LOOP.states.towards_goal,
          initial: 'work',
          states: {
            ...SESSION_LOOP.states.towards_goal.states,
            work: {
              ...work,
              on: { ...work.on, 'callback.memories_ready': { actions: [{ type: 'emit_parent', params: { type: 'unhandled_raise' } }] } },
            },
          },
        },
      },
    }
    const actor = library.createActor(custom, 'towards_goal', loopContext())

    actor.takeEmits()
    actor.send({ type: 'callback.memories_ready', payload: { ok: true } })

    expect(actor.statePath?.()).toBe('towards_goal.work')
    expect(actor.takeEmits()).toEqual([])
  })
})
