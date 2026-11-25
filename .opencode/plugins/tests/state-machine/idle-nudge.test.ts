import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { createStateMachine, loadStateMachineLibrary } from '@plugins/state-machine/core/machine'

import type { EmitRequest } from '@plugins/state-machine/core/machine'

const withMachine = async () => {
  const library = await loadStateMachineLibrary()

  return createStateMachine({ library })
}

type Machine = Awaited<ReturnType<typeof withMachine>>

const emittedText = (emits: readonly EmitRequest[]): string => {
  const emitted = emits[0]

  return emitted !== undefined && isTextEmit(emitted) ? emitted.text : ''
}

type TextEmit = EmitRequest & { text: string }

const isTextEmit = (emit: EmitRequest): emit is TextEmit =>
  emit.type === 'emit.prompt' || emit.type === 'emit.dispatch'

const NUDGE_STATES = [
  {
    state: 'work',
    expects: 'CLAIM_WORK',
    enter: (machine: Machine) => {
      machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
      machine.signal({ type: 'PLAN_READY' }, 'ses_1')
    },
  },
  {
    state: 'check',
    expects: 'quality check',
    enter: (machine: Machine) => {
      machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
      machine.signal({ type: 'PLAN_READY' }, 'ses_1')
      machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    },
  },
  {
    state: 'validate',
    expects: 'GOAL_ACHIEVED',
    enter: (machine: Machine) => {
      machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
      machine.signal({ type: 'PLAN_READY' }, 'ses_1')
      machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
      machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
    },
  },
  {
    state: 'memorize',
    expects: 'LESSON',
    enter: (machine: Machine) => {
      machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
      machine.signal({ type: 'PLAN_READY' }, 'ses_1')
      machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
      machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
      machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1')
    },
  },
  {
    state: 'retrospective',
    expects: 'RETROSPECTIVE_COMPLETE',
    enter: (machine: Machine) => {
      machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
      machine.signal({ type: 'PLAN_READY' }, 'ses_1')
      machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
      machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
      machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1')
      machine.signal({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1')
    },
  },
]

const parkIt = async (machine: Machine): Promise<void> => {
  machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
  machine.signal({ type: 'PLAN_READY' }, 'ses_1')
  await Effect.runPromise(machine.idle('ses_1'))
  machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
  machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
  machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1')
  machine.signal({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1')
  machine.signal({ type: 'RETROSPECTIVE_COMPLETE' }, 'ses_1')
}

const expectNudged = (machine: Machine, attempt: number): void => {
  expect(machine.get('ses_1')?.state).toBe('work')
  expect(machine.get('ses_1')?.context.nudges).toBe(attempt + 1)
}

const expectState = (machine: Machine, state: string): void => {
  expect(machine.get('ses_1')?.state).toBe(state)
}

const expectNudges = (machine: Machine, count: number): void => {
  expect(machine.get('ses_1')?.context.nudges).toBe(count)
}

describe('idle nudge', () => {
  it.each(NUDGE_STATES)('nudges $state with its own name and stays in $state', async ({ state, expects, enter }) => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    enter(machine)

    expectState(machine, state)

    const emits = await Effect.runPromise(machine.idle('ses_1'))

    expect(emittedText(emits)).toContain(state)
    expect(emittedText(emits)).toContain(expects)
    expectState(machine, state)
    expectNudges(machine, 1)
  })

  it('panics on the fourth idle of a round and records the failure', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'PLAN_READY' }, 'ses_1')

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await Effect.runPromise(machine.idle('ses_1'))
      expectNudged(machine, attempt)
    }

    const emits = await Effect.runPromise(machine.idle('ses_1'))
    const live = machine.get('ses_1')

    expect(emittedText(emits)).toContain('idle budget exhausted')
    expect(live).toMatchObject({ state: 'panic', context: { failure: { reason: 'idle budget exhausted' } } })
  })

  it('ignores idle in parked without spending the budget', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    await parkIt(machine)

    expectState(machine, 'parked')

    const emits = await Effect.runPromise(machine.idle('ses_1'))

    expect(emits.filter(emit => emit.type === 'emit.prompt')).toEqual([])
    expectNudges(machine, 1)
    expectState(machine, 'parked')
  })

  it('zeroes the budget on reset_goal so the next round starts at one', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    await parkIt(machine)

    machine.userInput('ses_1', 'next goal')

    expect(machine.get('ses_1')?.context.nudges).toBe(0)

    await Effect.runPromise(machine.idle('ses_1'))

    expect(machine.get('ses_1')?.context.nudges).toBe(1)
  })
})
