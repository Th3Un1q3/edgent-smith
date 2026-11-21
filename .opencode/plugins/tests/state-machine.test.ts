import { Effect, Exit } from 'effect'

import { describe, expect, it } from 'vitest'

import { createStateMachinePlugin } from '@plugins/state-machine'

import { createStateMachine, LOOP_STATE_IDS, loadStateMachineLibrary, promptDescription, readStartConfig, SESSION_LOOP } from '@plugins/state-machine/core/machine'

import type { EmitRequest, LoopDefinition, StateMachine } from '@plugins/state-machine/core/machine'

import { makeHarness, sessionCreated, sessionIdle, sessionInterrupted } from '@tests/helpers/state-machine-harness'

import { boot, emittedText, content, failureOf, stateAt, acceptedSignals, VALIDATOR_PROMPT, GOAL_REQUEST, WORK_PROMPT, PARKED_PROMPT } from '@tests/helpers/session-loop-fixtures'

import type { Harness } from '@tests/helpers/state-machine-harness'

describe('registration', () => {
  it('registers the signal tool in code mode', async () => {
    const harness = await boot()
    const tool = harness.tools.get('signal_send')

    expect(tool).toBeDefined()
    expect(tool?.options?.codemode).toBe(true)
  })

  it('opens the signal payload to the fields the current state declares', async () => {
    const harness = await boot()
    const input = harness.tools.get('signal_send')?.input as {
      readonly additionalProperties?: boolean
      readonly required?: readonly string[]
      readonly properties?: {
        readonly payload?: {
          readonly properties?: unknown
          readonly additionalProperties?: boolean
        }
      }
    }

    expect(input.properties?.payload?.properties).toBeUndefined()
    expect(input.properties?.payload?.additionalProperties).not.toBe(false)
    expect(input.additionalProperties).toBe(false)
    expect(input.required).toEqual(['type'])
  })

  it('fails the plugin load when the state library cannot load', async () => {
    const harness = makeHarness()
    const failing = createStateMachinePlugin(() => Promise.reject(new Error('library missing')))

    const exit = await Effect.runPromiseExit(Effect.scoped(failing.effect(harness.context)))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(harness.tools.size).toBe(0)
  })
})

describe('session start', () => {
  it('opens silently in define_goal and asks for the goal once the person speaks', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))

    expect(harness.synthetics).toHaveLength(0)

    await harness.emitUserMessage('ses_1', 'user', 'ship it')

    expect(harness.synthetics).toHaveLength(2)
    expect(harness.synthetics[0]?.text).toContain('What goal')
    expect(harness.synthetics[1]?.text).toContain('Signals now:')
    expect(harness.synthetics[1]?.text).toContain('- SET_GOAL — State the goal')
  })

  it('admits an unmapped agent to free_work and sends nothing', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'unmapped-agent'))

    expect(harness.synthetics).toHaveLength(0)
    expect(failureOf(await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1', 'unmapped-agent')).message)
      .toContain('CLAIM_WORK is not available in free_work')
  })

  it('sends nothing when the event carries no agent', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1'))

    expect(harness.synthetics).toHaveLength(0)
  })

  it('asks for the goal once per session, only after the person speaks', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.emit(sessionCreated('ses_1', 'rug'))

    expect(harness.synthetics).toHaveLength(0)

    await harness.emitUserMessage('ses_1', 'user', 'ship it')

    expect(harness.synthetics.filter(message => message.text.includes('What goal'))).toHaveLength(1)
  })
})

describe('transitions', () => {
  const withMachine = async (): Promise<Harness> => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    return harness
  }

  it('moves to work when the goal is supplied', async () => {
    const harness = await withMachine()

    const result = content(await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1'))

    expect(result).toContain('Signal accepted.')
    expect(harness.synthetics.at(-1)?.text).toContain('CLAIM_WORK')
  })

  it('refuses a start signal with no goal text', async () => {
    const harness = await withMachine()

    const failure = failureOf(await harness.runTool({ type: 'SET_GOAL', payload: { goal: ' '.repeat(2) } }, 'ses_1'))

    expect(failure.metadata?.code).toBe('invalid_payload')
    expect(failure.message).toContain('payload.goal')
  })

  it('refuses a transition the current state does not declare', async () => {
    const harness = await withMachine()

    const failure = failureOf(await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1'))

    expect(failure.metadata).toMatchObject({
      code: 'unavailable_signal',
      signal: 'CLAIM_WORK',
      state: 'define_goal',
      available_signals: ['SET_GOAL'],
    })
    expect(failure.message).toContain('CLAIM_WORK is not available in define_goal.')
    expect(failure.message).toContain('- SET_GOAL — State the goal this session must accomplish, in payload.goal.')
  })

  it('runs the quality check and moves to validation when it passes', async () => {
    const harness = await withMachine()

    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    const result = content(await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1'))

    expect(harness.shellCommands).toEqual(['just opencode::typecheck'])
    expect(result).toContain('Signal accepted.')
    expect(harness.createdSessions).toHaveLength(0)
    expect(harness.synthetics.some(message => message.text.includes('Verdict'))).toBe(true)
    expect(harness.synthetics.find(message => message.text.includes('Verdict'))?.description)
      .toBe(VALIDATOR_PROMPT)
  })

  it('records the quality check failure and parks in panic', async () => {
    const harness = await withMachine()

    harness.shellResult = { ok: false, exitCode: 1, output: 'type error' }
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    const result = content(await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1'))

    expect(result).toContain('Signal accepted.')

    const failurePrompt = harness.synthetics.find(message => message.text.includes('Quality check failed'))

    expect(failurePrompt?.text).toContain('type error')
  })

  it('injects the configured skill and renders the remembered preferences', async () => {
    const harness = await boot()

    harness.memories = { full: ['be terse'], index: [] }
    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.emitUserMessage('ses_1', 'user', 'ship it')
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    expect(harness.injectedSkills).toEqual(['task-delegation'])

    const prompt = harness.synthetics.find(message => message.text.includes('Work towards: ship it'))

    expect(prompt?.text).toContain('be terse')
  })

  it('refuses every signal in the final state, naming no transition', async () => {
    const harness = await withMachine()

    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1')
    await harness.runTool({ type: 'GOAL_ACHIEVED' }, 'ses_1')
    await harness.runTool({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1')

    const failure = failureOf(await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1'))

    expect(failure.metadata?.code).toBe('unavailable_signal')
    expect(failure.metadata?.available_signals).toEqual(['LESSON'])
    expect(failure.message).toContain('CLAIM_WORK is not available in parked.')
    expect(failure.message).toContain('- LESSON — ')
  })

  it('refuses a signal type outside the vocabulary', async () => {
    const harness = await withMachine()

    const failure = failureOf(await harness.runTool({ type: 'START_WITH_GOAL' }, 'ses_1'))

    expect(failure.metadata).toMatchObject({
      code: 'unknown_signal',
      signal: 'START_WITH_GOAL',
      state: 'define_goal',
      available_signals: ['SET_GOAL'],
    })
    expect(failure.message).toContain('Unknown signal: START_WITH_GOAL.')
    expect(failure.message).toContain('Signals now:')
  })

  it('refuses a LESSON in a state that does not declare it', async () => {
    const harness = await withMachine()

    const failure = failureOf(await harness.runTool({ type: 'LESSON', payload: { text: 'do better' } }, 'ses_1'))

    expect(failure.metadata?.code).toBe('unavailable_signal')
    expect(failure.metadata?.available_signals).toEqual(['SET_GOAL'])
    expect(failure.message).toContain('LESSON is not available in define_goal')
  })

  it('refuses a SET_GOAL whose goal is not a string', async () => {
    const harness = await withMachine()

    const failure = failureOf(await harness.runTool({ type: 'SET_GOAL', payload: { goal: 4 } }, 'ses_1'))

    expect(failure.metadata?.code).toBe('invalid_payload')
    expect(failure.message).toContain('payload.goal: expected string')
  })

  it('refuses a malformed envelope', async () => {
    const harness = await withMachine()

    expect(failureOf(await harness.runTool('nope', 'ses_1')).metadata?.code).toBe('unknown_signal')
    expect(failureOf(await harness.runTool({ type: 7 }, 'ses_1')).metadata?.available_signals)
      .toEqual(['SET_GOAL'])

    const extra = failureOf(await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' }, extra: 1 }, 'ses_1'))

    expect(extra.metadata?.code).toBe('invalid_payload')
    expect(extra.message).toContain('extra: expected only type and payload')

    const badGoal = failureOf(await harness.runTool({ type: 'SET_GOAL', payload: { goal: 3 } }, 'ses_1'))

    expect(badGoal.message).toContain('payload.goal: expected string')
  })
})

describe('idle', () => {
  it('moves a working session to validation on idle', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    await harness.emit(sessionIdle('ses_1'))

    const verdict = harness.synthetics.find(message => message.text.includes('Verdict'))
    const signals = harness.synthetics.filter(message => message.text.includes('Signals now:'))

    expect(verdict?.description).toBe(VALIDATOR_PROMPT)
    expect(signals.some(message => message.text.includes('GOAL_ACHIEVED'))).toBe(true)
    expect(signals.some(message => message.text.includes('GOAL_INCOMPLETE'))).toBe(true)
    expect(harness.synthetics.some(message => message.text.includes('still in work'))).toBe(false)

    const failure = failureOf(await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1'))

    expect(failure.metadata).toMatchObject({
      code: 'unavailable_signal',
      state: 'validate',
      available_signals: ['GOAL_ACHIEVED', 'GOAL_INCOMPLETE'],
    })
  })

  it('moves define_goal to validation on idle', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))

    await harness.emit(sessionIdle('ses_1'))

    expect(harness.synthetics[0]?.text).toContain('Verdict')
    expect(harness.synthetics[0]?.description).toBe(VALIDATOR_PROMPT)

    const failure = failureOf(await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1'))

    expect(failure.metadata?.state).toBe('validate')
  })

  it('ignores an idle once parked', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1')
    await harness.runTool({ type: 'GOAL_ACHIEVED' }, 'ses_1')
    await harness.runTool({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1')

    const spoken = harness.synthetics.length

    await harness.emit(sessionIdle('ses_1'))

    expect(harness.synthetics).toHaveLength(spoken)
    expect(harness.synthetics.slice(spoken).some(message => message.text.includes('Verdict'))).toBe(false)

    const failure = failureOf(await harness.runTool({ type: 'GOAL_ACHIEVED' }, 'ses_1'))

    expect(failure.metadata?.state).toBe('parked')
  })

  it('stays parked when more idles arrive', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1')
    await harness.runTool({ type: 'GOAL_ACHIEVED' }, 'ses_1')
    await harness.runTool({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1')

    const spoken = harness.synthetics.length

    await harness.emit(sessionIdle('ses_1'))
    await harness.emit(sessionIdle('ses_1'))
    await harness.emit(sessionIdle('ses_1'))
    await harness.emit(sessionIdle('ses_1'))

    expect(harness.synthetics).toHaveLength(spoken)
    expect(harness.synthetics.slice(spoken).some(message => message.text.includes('Verdict'))).toBe(false)
  })
})

describe('interruption', () => {
  it('parks a working session and sends the parked summary', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    await harness.emit(sessionInterrupted('ses_1', 'user'))

    const failure = failureOf(await harness.runTool({ type: 'GOAL_ACHIEVED' }, 'ses_1'))

    expect(failure.metadata).toMatchObject({
      code: 'unavailable_signal',
      signal: 'GOAL_ACHIEVED',
      state: 'parked',
      available_signals: ['CLAIM_WORK'],
    })
    expect(failure.message).toContain('GOAL_ACHIEVED is not available in parked.')
    expect(failure.message).toContain('- CLAIM_WORK — Say the work is done and ready for the quality check.')
    expect(harness.synthetics.at(-1)?.text).toContain('Waiting for your next instruction')
    expect(harness.synthetics.at(-1)?.description).toBe(PARKED_PROMPT)
  })

  it('ignores an interruption for a session the loop never opened', async () => {
    const harness = await boot()

    await harness.emit(sessionInterrupted('ses_ghost', 'shutdown'))
    await harness.emit(sessionInterrupted('ses_ghost', 'shutdown'))

    expect(harness.synthetics).toHaveLength(0)
  })
})

describe('the emit transport', () => {
  const withMachine = async () => {
    const library = await loadStateMachineLibrary()

    return createStateMachine({ library })
  }

  it('holds the goal request for the first user message instead of sending it', async () => {
    const machine = await withMachine()
    const started = machine.start('ses_1', 'rug')

    expect(started?.emits).toEqual([])
    expect(machine.wake('ses_1')).toContainEqual({
      type: 'emit.prompt',
      text: expect.stringContaining('What goal'),
      description: GOAL_REQUEST,
    })
  })

  it('carries the description the action supplied on every prompt emit', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')

    const emits = machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1').emits
    const prompt = emits.find(emitted => emitted.type === 'emit.prompt')

    expect(prompt).toMatchObject({ description: WORK_PROMPT })
  })

  it('names a prompt emit that supplies no description by its opening words', () => {
    expect(promptDescription({ text: 'Verdict: call signal_send with type GOAL_ACHIEVED' }))
      .toBe('Sent synthetic message: Verdict: call signal...')
  })

  it('keeps the supplied description instead of the fallback', () => {
    expect(promptDescription({ text: 'Verdict: call signal_send', description: VALIDATOR_PROMPT }))
      .toBe(VALIDATOR_PROMPT)
  })

  it('records the goal in the machine context on SET_GOAL', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')

    const result = machine.signal({ type: 'SET_GOAL', payload: { goal: '  ship it  ' } }, 'ses_1')

    expect(result.text).toBe('Signal accepted.')
    expect(result.emits.map(emitted => emitted.type)).toEqual(['emit.prompt', 'emit.signals', 'emit.skill'])
    expect(machine.get('ses_1')?.context.goal).toBe('ship it')
  })

  it('emits the validation prompt', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    const emits = await Effect.runPromise(machine.idle('ses_1'))

    expect(emits).toContainEqual({
      type: 'emit.prompt',
      text: expect.stringContaining('Verdict'),
      description: VALIDATOR_PROMPT,
    })
    expect(emits).toContainEqual({ type: 'emit.signals', signal_keys: ['GOAL_ACHIEVED', 'GOAL_INCOMPLETE'] })
    expect(machine.get('ses_1')?.state).toBe('validate')
  })

  it('never parks the machine on idle however many arrive', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await Effect.runPromise(machine.idle('ses_1'))
    }

    const emits = await Effect.runPromise(machine.idle('ses_1'))

    expect(emittedText(emits)).toContain('Verdict')
    expect(emittedText(emits)).not.toContain('parked in panic')
    expect(machine.get('ses_1')?.state).toBe('validate')
  })

  it('requests the remembered preferences from the starting state', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')

    expect(machine.wake('ses_1')).toContainEqual({
      type: 'emit.memories',
      namespace: 'preferences/user',
      reportTo: 'memories_ready',
    })
  })

  it('folds remembered preferences into the context', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    machine.callback('ses_1', 'memories_ready', { ok: true, value: { full: ['be terse'], index: [] } })

    expect(machine.get('ses_1')?.context.injected['preferences/user']?.full).toEqual(['be terse'])
  })

  it('emits the work prompt and the skill request on SET_GOAL', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')

    const result = machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    expect(result.emits).toEqual([
      { type: 'emit.prompt', text: expect.stringContaining('Work towards: ship it'), description: WORK_PROMPT },
      { type: 'emit.signals', signal_keys: ['CLAIM_WORK'] },
      { type: 'emit.skill', name: 'task-delegation', reportTo: 'skill_ready' },
    ])
  })

  it('records the injected skill and does not request it twice', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.callback('ses_1', 'skill_ready', { ok: true })

    expect(machine.get('ses_1')?.context.injectedSkills).toEqual(['skill:task-delegation:complete'])

    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
    machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')

    const emits = machine.signal({ type: 'LESSON', payload: { text: 'retry' } }, 'ses_1').emits

    expect(emits.some(emitted => emitted.type === 'emit.skill')).toBe(false)
  })

  it('drops the oldest lesson past the memory limit', async () => {
    const library = await loadStateMachineLibrary()
    const machine = createStateMachine({
      library,
      memoryLimit: 2,
    })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    for (const text of ['first', 'second', 'third']) {
      machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
      machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
      machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')
      machine.signal({ type: 'LESSON', payload: { text } }, 'ses_1')
    }

    expect(machine.get('ses_1')?.context.memories).toEqual(['second', 'third'])
  })

  it('emits a shell request when the work is claimed', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    const result = machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')

    expect(result.text).toBe('Signal accepted.')
    expect(result.emits).toEqual([
      { type: 'emit.shell', cmd: 'just opencode::typecheck', reportTo: 'quality_check_ready' },
    ])
    expect(machine.get('ses_1')?.state).toBe('check')
  })

  it('records a passing callback in the results and moves on', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')

    const emits = machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0, output: 'clean' })

    expect(machine.get('ses_1')?.state).toBe('validate')
    expect(emittedText(emits)).toContain('Verdict')
    expect(machine.get('ses_1')?.context.results.quality_check_ready).toEqual({
      ok: true,
      exitCode: 0,
      output: 'clean',
    })
  })

  it('records a failing callback, prompts with the failure, and parks', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')

    const emits = machine.callback('ses_1', 'quality_check_ready', { ok: false, exitCode: 1, output: 'boom' })

    expect(emittedText(emits)).toContain('Quality check failed')
    expect(machine.get('ses_1')?.state).toBe('panic')
    expect(machine.get('ses_1')?.context.failure?.detail).toBe('boom')
  })

  const enterValidate = (machine: StateMachine): readonly EmitRequest[] => {
    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    return machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
  }

  const failAttempt = (machine: StateMachine): void => {
    machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')
    machine.signal({ type: 'LESSON', payload: { text: 'retry' } }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
  }

  it('asks the loop agent for a verdict when the quality check passes', async () => {
    const machine = await withMachine()

    const emits = enterValidate(machine)

    expect(machine.get('ses_1')?.state).toBe('validate')
    expect(emittedText(emits)).toContain('Verdict')
  })

  it('records an achieved goal and asks for an improvement', async () => {
    const machine = await withMachine()

    enterValidate(machine)

    const emits = machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1').emits

    expect(machine.get('ses_1')?.state).toBe('memorize')
    expect(machine.get('ses_1')?.context.intent).toBe('improvement')
    expect(emittedText(emits)).toContain('improvement')
  })

  it('records the improvement and parks', async () => {
    const machine = await withMachine()

    enterValidate(machine)
    machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1')

    const emits = machine.signal({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1').emits

    expect(machine.get('ses_1')?.state).toBe('parked')
    expect(machine.get('ses_1')?.context.improvements).toEqual(['faster'])
    expect(emittedText(emits)).toContain('Waiting for your next instruction')
  })

  it('starts a new round on user input from parked', async () => {
    const machine = await withMachine()

    enterValidate(machine)
    machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1')
    machine.signal({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1')

    const emits = machine.userInput('ses_1', 'next goal')

    expect(machine.get('ses_1')?.state).toBe('define_goal')
    expect(machine.get('ses_1')?.context.goal).toBe('')
    expect(machine.get('ses_1')?.context.intent).toBe('none')
    expect(machine.get('ses_1')?.context.attempts).toBe(0)
    expect(emittedText(emits)).toContain('What goal')
  })

  it('starts a new round on user input from panic', async () => {
    const machine = await withMachine()

    enterValidate(machine)
    failAttempt(machine)
    failAttempt(machine)
    failAttempt(machine)
    machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')

    const emits = machine.userInput('ses_1', 'start over')

    expect(machine.get('ses_1')?.state).toBe('define_goal')
    expect(machine.get('ses_1')?.context.attempts).toBe(0)
    expect(emittedText(emits)).toContain('What goal')
  })

  it('counts an incomplete goal and asks for a lesson', async () => {
    const machine = await withMachine()

    enterValidate(machine)

    const emits = machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1').emits

    expect(machine.get('ses_1')?.state).toBe('memorize')
    expect(machine.get('ses_1')?.context.attempts).toBe(1)
    expect(machine.get('ses_1')?.context.intent).toBe('lesson')
    expect(emittedText(emits)).toContain('change next attempt')
  })

  it('records a lesson and returns to work', async () => {
    const machine = await withMachine()

    enterValidate(machine)
    machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')
    machine.signal({ type: 'LESSON', payload: { text: 'try harder' } }, 'ses_1')

    expect(machine.get('ses_1')?.state).toBe('work')
    expect(machine.get('ses_1')?.context.memories).toEqual(['try harder'])
  })

  it('escalates to panic after the last attempt', async () => {
    const machine = await withMachine()

    enterValidate(machine)
    failAttempt(machine)
    failAttempt(machine)
    failAttempt(machine)

    expect(machine.get('ses_1')?.context.attempts).toBe(3)

    const result = machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')

    expect(machine.get('ses_1')?.state).toBe('panic')
    expect(machine.get('ses_1')?.context.failure?.reason).toBe('attempts exhausted')
    expect(emittedText(result.emits)).toContain('attempts exhausted')
  })

  it('retries from panic on a lesson', async () => {
    const machine = await withMachine()

    enterValidate(machine)
    failAttempt(machine)
    failAttempt(machine)
    failAttempt(machine)
    machine.signal({ type: 'GOAL_INCOMPLETE' }, 'ses_1')

    machine.signal({ type: 'LESSON', payload: { text: 'try differently' } }, 'ses_1')

    expect(machine.get('ses_1')?.state).toBe('work')
    expect(machine.get('ses_1')?.context.attempts).toBe(0)
    expect(machine.get('ses_1')?.context.memories).toContain('try differently')
  })
})

describe('the loop definition', () => {
  it('declares seven states and their transitions', () => {
    expect(LOOP_STATE_IDS).toEqual(['admission', 'towards_goal', 'parked', 'panic', 'free_work'])
    expect(acceptedSignals('towards_goal.define_goal')).toEqual(['SET_GOAL'])
    expect(acceptedSignals('towards_goal.work')).toEqual(['CLAIM_WORK'])
    expect(acceptedSignals('towards_goal.check')).toEqual([])
    expect(acceptedSignals('towards_goal.validate')).toEqual(['GOAL_ACHIEVED', 'GOAL_INCOMPLETE'])
    expect(acceptedSignals('towards_goal.memorize')).toEqual(['LESSON'])
    expect(acceptedSignals('parked')).toEqual([])
    expect(acceptedSignals('panic')).toEqual(['LESSON'])
  })

  it('asks for the goal from the starting state entry and routes idle from the compound state', () => {
    expect(stateAt('towards_goal.define_goal').entry).toEqual([
      { type: 'prompt', params: { template: 'goal_request', description: GOAL_REQUEST } },
      { type: 'update_signals_policy', params: { set_enabled_signals: ['SET_GOAL'], notify_agent: true } },
      { type: 'request_memories', params: { namespace: 'preferences/user' } },
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
      { type: 'prompt', params: { template: 'work_towards_goal', description: WORK_PROMPT } },
      { type: 'update_signals_policy', params: { set_enabled_signals: ['CLAIM_WORK'], notify_agent: true } },
      { type: 'request_skill', params: { name: 'task-delegation' } },
    ])
    expect(stateAt('towards_goal.define_goal').on.system_idle).toBeUndefined()
    expect(stateAt('towards_goal.work').on.system_idle).toBeUndefined()

    expect(SESSION_LOOP.on?.system_idle).toBeUndefined()

    expect(SESSION_LOOP.states.towards_goal.on?.system_idle)
      .toMatchObject({ target: '#session.towards_goal.validate', guard: { type: 'not_parked' } })
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
      on: { system_interrupted: { target: '.panic', guard: { type: 'not_parked' } } },
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
        panic: {
          ...SESSION_LOOP.states.panic,
          on: { ...SESSION_LOOP.states.panic.on, system_idle: { target: 'towards_goal.work' } },
        },
      },
    }
    const actor = library.createActor(custom, 'panic', context)

    actor.send({ type: 'system_idle' })

    expect(actor.state()).toBe('work')
  })
})

describe('the start configuration', () => {
  it('maps known agents and reports entries naming an unknown state', () => {
    const config = readStartConfig({ rug: 'towards_goal.define_goal', broken: 'nowhere' })

    expect(config.startStateFor('rug')).toBe('towards_goal.define_goal')
    expect(config.startStateFor('broken')).toBeUndefined()
    expect(config.invalidAgents).toEqual(['broken'])
  })
})
