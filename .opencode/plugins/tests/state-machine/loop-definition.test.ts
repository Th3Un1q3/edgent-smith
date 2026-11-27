import { describe, expect, it } from 'vitest'

import { createStateMachine, loadStateMachineLibrary, LOOP_STATE_IDS, SESSION_LOOP } from '@plugins/state-machine/core/machine'

import { acceptedSignals, GOAL_REQUEST, stateAt, WORK_PROMPT } from '@tests/helpers/state-machine/session-loop-fixtures'

import { stageTemplate, stageText } from '@tests/helpers/state-machine/stage-text'

import type { LoopDefinition } from '@plugins/state-machine/core/machine'

describe('the loop definition', () => {
  it('declares seven states and their transitions', () => {
    expect(LOOP_STATE_IDS).toEqual(['admission', 'towards_goal', 'free_work'])
    expect(acceptedSignals('towards_goal.define_goal')).toEqual(['SET_GOAL'])
    expect(acceptedSignals('towards_goal.work')).toEqual(['CLAIM_WORK'])
    expect(acceptedSignals('towards_goal.check')).toEqual([])
    expect(acceptedSignals('towards_goal.validate')).toEqual(['GOAL_ACHIEVED', 'GOAL_INCOMPLETE'])
    expect(acceptedSignals('towards_goal.memorize')).toEqual(['LESSON'])
    expect(acceptedSignals('towards_goal.retrospective')).toEqual(['RETROSPECTIVE_COMPLETE'])
    expect(acceptedSignals('towards_goal.parked')).toEqual([])
    expect(acceptedSignals('towards_goal.panic')).toEqual(['LESSON'])
  })

  it('asks for the goal from the starting state entry and routes idle from the compound state', () => {
    expect(stateAt('towards_goal.define_goal').entry).toEqual([
      {
        type: 'prompt',
        params: {
          text: stageText('goal_request'),
          skills: ['progressive-goal-setting'],
          description: GOAL_REQUEST,
        },
      },
      { type: 'update_signals_policy', params: { set_enabled_signals: ['SET_GOAL'] } },
      { type: 'recall_memories', params: { namespace: 'preferences/user' } },
      {
        type: 'set_tools_policy',
        params: {
          stateId: 'define_goal',
          allowedTools: ['signal_send', 'execute', 'question', 'skill'],
          errorMessage: 'Tool <name> is blocked in <state>. Call signal_send with SET_GOAL and a goal to continue.',
        },
      },
    ])
    expect(stateAt('towards_goal.work').entry).toEqual([
      {
        type: 'prompt',
        params: {
          text: stageTemplate('work_towards_goal'),
          skills: ['progressive-work', 'task-delegation'],
          description: WORK_PROMPT,
        },
      },
      { type: 'update_signals_policy', params: { set_enabled_signals: ['CLAIM_WORK'] } },
    ])
    expect(stateAt('towards_goal.define_goal').on.system_idle).toBeUndefined()
    expect(stateAt('towards_goal.work').on.system_idle).toBeUndefined()
    expect(stateAt('towards_goal.retrospective').on.system_idle).toBeUndefined()

    expect(SESSION_LOOP.on?.system_idle).toBeUndefined()

    expect(stateAt('towards_goal.parked').on.system_idle).toEqual({ actions: [] })
    expect(stateAt('towards_goal.panic').on.system_idle).toEqual({ actions: [] })

    const on = SESSION_LOOP.states.towards_goal.on as unknown as { system_idle: readonly Record<string, unknown>[] }
    const idle = on.system_idle

    expect(idle).toHaveLength(2)
    expect(idle[0]).toMatchObject({
      guard: { type: 'counter_below', params: { key: 'nudges', limit: 3 } },
      actions: [
        { type: 'record', params: { op: 'increment', key: 'nudges' } },
        { type: 'prompt', params: { text: stageTemplate('idle_nudge') } },
      ],
    })
    expect(idle[0]?.target).toBeUndefined()
    expect(idle[1]).toMatchObject({ target: '#session.towards_goal.panic' })
  })

  it('honours the root transitions of the definition it is given', async () => {
    const library = await loadStateMachineLibrary()
    const machine = createStateMachine({
      library,
    })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    const context = machine.get('ses_1')?.context

    if (context === undefined) throw new Error('the started machine has no context')

    const custom: LoopDefinition = {
      ...SESSION_LOOP,
      on: { system_interrupted: { target: '#session.towards_goal.panic', guard: { type: 'not_parked' } } },
    }
    // `admission` carries no interruption arm of its own, so the supplied root
    // `on` is the only transition that can fire: the definition's root reaches the library.
    const actor = library.createActor(custom, 'admission', context)

    actor.send({ type: 'system_interrupted', reason: 'user' })

    expect(actor.state()).toBe('panic')

    const standard = library.createActor(SESSION_LOOP, 'towards_goal', context)

    standard.send({ type: 'system_interrupted', reason: 'user' })

    expect(standard.state()).toBe('parked')
  })

  it('builds the state table from the definition it is given', async () => {
    const library = await loadStateMachineLibrary()
    const machine = createStateMachine({
      library,
    })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    const context = machine.get('ses_1')?.context

    if (context === undefined) throw new Error('the started machine has no context')

    const custom: LoopDefinition = {
      ...SESSION_LOOP,
      states: {
        ...SESSION_LOOP.states,
        towards_goal: {
          ...SESSION_LOOP.states.towards_goal,
          on: { ...SESSION_LOOP.states.towards_goal.on, system_idle: { target: '#session.towards_goal.work' } },
        },
      },
    }
    const actor = library.createActor(custom, 'towards_goal', context)

    actor.send({ type: 'system_idle' })

    expect(actor.state()).toBe('work')
  })
})
