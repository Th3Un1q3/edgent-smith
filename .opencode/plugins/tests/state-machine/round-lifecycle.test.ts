import { describe, expect, it } from 'vitest'

import { createLoopMachine, emittedText } from '@tests/helpers/state-machine/session-loop-fixtures'

import { stageEnd, stageRendered, stageText } from '@tests/helpers/state-machine/stage-text'

import type { EmitRequest, StateMachine } from '@plugins/state-machine/core/machine'

describe('the round lifecycle', () => {
  const enterValidate = (machine: StateMachine): readonly EmitRequest[] => {
    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'PLAN_READY' }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    return machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
  }

  const failAttempt = (machine: StateMachine): void => {
    machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')
    machine.signal({ type: 'LESSON', payload: { text: 'retry' } }, 'ses_1')
    machine.signal({ type: 'RETROSPECTIVE_COMPLETE' }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
  }

  it('asks the loop agent for a verdict when the quality check passes', async () => {
    const machine = await createLoopMachine()

    const emits = enterValidate(machine)

    expect(machine.get('ses_1')?.state).toBe('validate')
    expect(emittedText(emits)).toContain(stageText('validation_self_report'))
  })

  it('records an achieved goal and asks for an improvement', async () => {
    const machine = await createLoopMachine()

    enterValidate(machine)

    const emits = machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1').emits

    expect(machine.get('ses_1')?.state).toBe('memorize')
    expect(machine.get('ses_1')?.context.intent).toBe('improvement')
    expect(emittedText(emits)).toContain('improvement')
  })

  it('records the improvement and parks', async () => {
    const machine = await createLoopMachine()

    enterValidate(machine)
    machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1')

    machine.signal({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1')

    const emits = machine.signal({ type: 'RETROSPECTIVE_COMPLETE' }, 'ses_1').emits

    expect(machine.get('ses_1')?.state).toBe('parked')
    expect(machine.get('ses_1')?.context.improvements).toEqual(['faster'])
    expect(emittedText(emits)).toContain(stageEnd('park_summary'))
  })

  it('starts a new round on user input from parked', async () => {
    const machine = await createLoopMachine()

    enterValidate(machine)
    machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1')
    machine.signal({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1')
    machine.signal({ type: 'RETROSPECTIVE_COMPLETE' }, 'ses_1')

    const emits = machine.userInput('ses_1', 'next goal')
    const live = machine.get('ses_1')

    expect(live?.state).toBe('define_goal')
    expect(live?.context).toMatchObject({ goal: '', intent: 'none', attempts: 0 })
    expect(emittedText(emits)).toContain(stageText('goal_request'))
  })

  it('starts a new round on user input from panic', async () => {
    const machine = await createLoopMachine()

    enterValidate(machine)
    failAttempt(machine)
    failAttempt(machine)
    failAttempt(machine)
    machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')

    const emits = machine.userInput('ses_1', 'start over')

    expect(machine.get('ses_1')?.state).toBe('define_goal')
    expect(machine.get('ses_1')?.context.attempts).toBe(0)
    expect(emittedText(emits)).toContain(stageText('goal_request'))
  })

  it('counts an incomplete goal and asks for a lesson', async () => {
    const machine = await createLoopMachine()

    enterValidate(machine)

    const emits = machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1').emits

    expect(machine.get('ses_1')).toMatchObject({
      state: 'memorize',
      context: { attempts: 1, intent: 'lesson' },
    })
    expect(emittedText(emits)).toContain(stageRendered('memorize', { improvement: false }))
  })

  it('records a lesson and returns to work', async () => {
    const machine = await createLoopMachine()

    enterValidate(machine)
    machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')
    machine.signal({ type: 'LESSON', payload: { text: 'try harder' } }, 'ses_1')
    machine.signal({ type: 'RETROSPECTIVE_COMPLETE' }, 'ses_1')

    expect(machine.get('ses_1')?.state).toBe('work')
    expect(machine.get('ses_1')?.context.memories).toEqual(['try harder'])
  })

  it('escalates to panic after the last attempt', async () => {
    const machine = await createLoopMachine()

    enterValidate(machine)
    failAttempt(machine)
    failAttempt(machine)
    failAttempt(machine)

    expect(machine.get('ses_1')?.context.attempts).toBe(3)

    const result = machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')
    const live = machine.get('ses_1')

    expect(live).toMatchObject({ state: 'panic', context: { failure: { reason: 'attempts exhausted' } } })
    expect(emittedText(result.emits)).toContain('attempts exhausted')
  })

  it('retries from panic on a lesson', async () => {
    const machine = await createLoopMachine()

    enterValidate(machine)
    failAttempt(machine)
    failAttempt(machine)
    failAttempt(machine)
    machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')

    machine.signal({ type: 'LESSON', payload: { text: 'try differently' } }, 'ses_1')

    expect(machine.get('ses_1')).toMatchObject({
      state: 'work',
      context: { attempts: 0, memories: expect.arrayContaining(['try differently']) },
    })
  })
})
