import { describe, expect, it } from 'vitest'

import { createStateMachine, loadStateMachineLibrary, promptDescription } from '@plugins/state-machine/core/machine'

import { boot, createLoopMachine, emittedText, VALIDATOR_PROMPT, WORK_PROMPT } from '@tests/helpers/state-machine/session-loop-fixtures'

import { promptCalls, sessionCreated } from '@tests/helpers/state-machine/harness'

import { stageStart, stageText } from '@tests/helpers/state-machine/stage-text'

const PLAN_PROMPT = 'Ask the agent to shape the goal before dispatching any work.'

describe('the emit transport', () => {
  it('holds the goal request for the first user message instead of sending it', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))

    expect(promptCalls).toEqual([])
    expect(harness.synthetics.some(message => message.text.includes(stageText('goal_request')))).toBe(false)

    await harness.emitUserMessage('ses_1', 'user', 'ship it')

    expect(promptCalls).toContainEqual({
      sessionID: 'ses_1',
      text: stageText('goal_request'),
      skills: [{ id: 'progressive-goal-setting' }],
    })
    expect(harness.synthetics.some(message => message.text.includes(stageText('goal_request')))).toBe(false)
  })

  it('carries the description the action supplied on every prompt emit', async () => {
    const machine = await createLoopMachine()

    machine.start('ses_1', 'rug')

    const plan = machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1').emits
    const work = machine.signal({ type: 'PLAN_READY' }, 'ses_1').emits
    const prompts = [...plan, ...work].filter(emitted => emitted.type === 'emit.prompt')

    expect(prompts).toEqual([
      expect.objectContaining({ description: PLAN_PROMPT }),
      expect.objectContaining({ description: WORK_PROMPT }),
    ])
  })

  it('names a prompt emit that supplies no description by its opening words', () => {
    const text = 'lorem ipsum dolor sit amet'

    expect(promptDescription({ text })).toBe('Sent synthetic message: ' + text.slice(0, 20) + '...')
  })

  it('keeps the supplied description instead of the fallback', () => {
    expect(promptDescription({ text: 'lorem ipsum', description: VALIDATOR_PROMPT }))
      .toBe(VALIDATOR_PROMPT)
  })

  it('records the goal in the machine context on SET_GOAL', async () => {
    const machine = await createLoopMachine()

    machine.start('ses_1', 'rug')

    const result = machine.signal({ type: 'SET_GOAL', payload: { goal: '  ship it  ' } }, 'ses_1')

    expect(result.text).toBe('Signal accepted.')
    expect(result.emits.map(emitted => emitted.type)).toEqual(['emit.prompt', 'emit.signals'])
    expect(machine.get('ses_1')?.context.goal).toBe('ship it')
  })

  it('requests the remembered preferences from the starting state', async () => {
    const machine = await createLoopMachine()

    machine.start('ses_1', 'rug')

    expect(machine.wake('ses_1')).toContainEqual({
      type: 'emit.memories',
      namespace: 'preferences/user',
      reportTo: 'memories_ready',
    })
  })

  it('folds remembered preferences into the context', async () => {
    const machine = await createLoopMachine()

    machine.start('ses_1', 'rug')
    machine.callback('ses_1', 'memories_ready', { ok: true, value: { full: ['be terse'], index: [] } })

    expect(machine.get('ses_1')?.context.injected['preferences/user']?.full).toEqual(['be terse'])
  })

  it('delivers the plan prompt on SET_GOAL and the work prompt with its skills on PLAN_READY', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    expect(promptCalls).toContainEqual({
      sessionID: 'ses_1',
      text: stageText('plan_stage'),
      skills: [{ id: 'progressive-plan' }],
    })
    expect(harness.synthetics.some(message => message.text.includes(stageText('plan_stage')))).toBe(false)

    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')

    expect(promptCalls).toContainEqual({
      sessionID: 'ses_1',
      text: expect.stringContaining(stageStart('work_towards_goal') + 'ship it'),
      skills: [{ id: 'progressive-work' }, { id: 'task-delegation' }],
    })
    expect(harness.synthetics.some(message => message.text.includes(stageStart('work_towards_goal') + 'ship it'))).toBe(false)
  })

  it('records the skills a prompt carries once and does not add them again on re-entry', async () => {
    const machine = await createLoopMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'PLAN_READY' }, 'ses_1')

    const delivered = [
      'skill:progressive-goal-setting:complete',
      'skill:progressive-plan:complete',
      'skill:progressive-work:complete',
      'skill:task-delegation:complete',
    ]

    expect(machine.get('ses_1')?.context.injectedSkills).toEqual(delivered)

    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
    machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')
    machine.signal({ type: 'LESSON', payload: { text: 'retry' } }, 'ses_1')
    machine.signal({ type: 'RETROSPECTIVE_COMPLETE' }, 'ses_1')

    expect(machine.get('ses_1')?.context.injectedSkills).toEqual([
      ...delivered,
      'skill:progressive-validation:complete',
      'skill:progressive-retrospective:complete',
      'skill:harness-management:complete',
    ])
  })

  it('drops the oldest lesson past the memory limit', async () => {
    const library = await loadStateMachineLibrary()
    const machine = createStateMachine({
      library,
      memoryLimit: 2,
    })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'PLAN_READY' }, 'ses_1')

    for (const text of ['first', 'second', 'third']) {
      machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
      machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
      machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')
      machine.signal({ type: 'LESSON', payload: { text } }, 'ses_1')
      machine.signal({ type: 'RETROSPECTIVE_COMPLETE' }, 'ses_1')
    }

    expect(machine.get('ses_1')?.context.memories).toEqual(['second', 'third'])
  })

  it('emits a shell request when the work is claimed', async () => {
    const machine = await createLoopMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'PLAN_READY' }, 'ses_1')

    const result = machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')

    expect(result.text).toBe('Signal accepted.')
    expect(result.emits).toEqual([
      { type: 'emit.shell', cmd: 'just opencode::typecheck', reportTo: 'quality_check_ready' },
    ])
    expect(machine.get('ses_1')?.state).toBe('check')
  })

  it('records a passing callback in the results and moves on', async () => {
    const machine = await createLoopMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'PLAN_READY' }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')

    const emits = machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0, output: 'clean' })

    expect(machine.get('ses_1')?.state).toBe('validate')
    expect(emittedText(emits)).toContain(stageText('validation_self_report'))
    expect(machine.get('ses_1')?.context.results.quality_check_ready).toEqual({
      ok: true,
      exitCode: 0,
      output: 'clean',
    })
  })

  it('records a failing callback, prompts with the failure, and parks', async () => {
    const machine = await createLoopMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'PLAN_READY' }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')

    const emits = machine.callback('ses_1', 'quality_check_ready', { ok: false, exitCode: 1, output: 'boom' })

    expect(emittedText(emits)).toContain(stageStart('quality_check_failed'))
    expect(machine.get('ses_1')?.state).toBe('panic')
    expect(machine.get('ses_1')?.context.failure).toMatchObject({ detail: 'boom' })
  })
})
