import { describe, expect, it } from 'vitest'

import { boot, content, failureOf } from '@tests/helpers/state-machine/session-loop-fixtures'

import { promptCalls, sessionCreated } from '@tests/helpers/state-machine/harness'

import { stageStart, stageText } from '@tests/helpers/state-machine/stage-text'

import type { Harness } from '@tests/helpers/state-machine/harness'

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

    const planned = content(await harness.runTool({ type: 'PLAN_READY' }, 'ses_1'))

    expect(planned).toContain('Signal accepted.')
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
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')

    const result = content(await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1'))

    expect(harness.shellCommands).toEqual(['just opencode::typecheck'])
    expect(result).toContain('Signal accepted.')
    expect(harness.createdSessions).toHaveLength(0)
    expect(promptCalls).toContainEqual({
      sessionID: 'ses_1',
      text: stageText('validation_self_report'),
      skills: [{ id: 'progressive-validation' }],
    })
  })

  it('records the quality check failure and parks in panic', async () => {
    const harness = await withMachine()

    harness.shellResult = { ok: false, exitCode: 1, output: 'type error' }
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')

    const result = content(await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1'))

    expect(result).toContain('Signal accepted.')

    const failurePrompt = harness.synthetics.find(message => message.text.includes(stageStart('quality_check_failed')))

    expect(failurePrompt?.text).toContain('type error')
  })

  it('injects the configured skill and renders the remembered preferences', async () => {
    const harness = await boot()

    harness.memories = { full: ['be terse'], index: [] }
    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.emitUserMessage('ses_1', 'user', 'ship it')
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')

    expect(promptCalls).toContainEqual({
      sessionID: 'ses_1',
      text: expect.stringContaining(stageStart('work_towards_goal') + 'ship it'),
      skills: [{ id: 'progressive-work' }, { id: 'task-delegation' }],
    })

    const prompt = promptCalls.find(call => call.text.includes(stageStart('work_towards_goal') + 'ship it'))

    expect(prompt?.text).toContain('be terse')
  })

  it('refuses every signal in the final state, naming no transition', async () => {
    const harness = await withMachine()

    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')
    await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1')
    await harness.runTool({ type: 'GOAL_ACHIEVED' }, 'ses_1')
    await harness.runTool({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1')

    const completed = content(await harness.runTool({ type: 'RETROSPECTIVE_COMPLETE' }, 'ses_1'))

    expect(completed).toBe('Signal accepted.')

    const failure = failureOf(await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1'))

    expect(failure.metadata?.code).toBe('unavailable_signal')
    expect(failure.metadata?.available_signals).toEqual([])
    expect(failure.message).toContain('CLAIM_WORK is not available in parked.')
    expect(failure.message).toContain('Signals now: none')
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

    expect(failureOf(await harness.runTool('nope', 'ses_1')).metadata).toMatchObject({ code: 'unknown_signal' })
    expect(failureOf(await harness.runTool({ type: 7 }, 'ses_1')).metadata?.available_signals)
      .toEqual(['SET_GOAL'])

    const extra = failureOf(await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' }, extra: 1 }, 'ses_1'))

    expect(extra.metadata?.code).toBe('invalid_payload')
    expect(extra.message).toContain('extra: expected only type and payload')

    const badGoal = failureOf(await harness.runTool({ type: 'SET_GOAL', payload: { goal: 3 } }, 'ses_1'))

    expect(badGoal.message).toContain('payload.goal: expected string')
  })
})
