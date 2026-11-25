import { describe, expect, it } from 'vitest'

import { RETROSPECTIVE_COMPLETE } from '@plugins/state-machine/core/machine'

import { boot, content, failureOf } from '@tests/helpers/state-machine/session-loop-fixtures'

import { sessionCreated, sessionIdle } from '@tests/helpers/state-machine/harness'

import { templateStart, templateText } from '@tests/helpers/state-machine/template-text'

import type { Harness } from '@tests/helpers/state-machine/harness'

describe('idle', () => {
  it('nudges a working session instead of moving it to validation', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')

    await harness.emit(sessionIdle('ses_1'))

    const nudge = harness.synthetics.find(message => message.text.includes('CLAIM_WORK'))

    expect(nudge?.text).toContain('work')
    expect(harness.synthetics.some(message => message.text.includes(templateText('validation_self_report')))).toBe(false)
    expect(content(await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1'))).toBe('Signal accepted.')
  })

  it('nudges define_goal to send its goal instead of evaluating one', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))

    await harness.emit(sessionIdle('ses_1'))

    const nudge = harness.synthetics.find(message => message.text.includes('define_goal'))

    expect(nudge?.text).toContain('SET_GOAL')
    expect(harness.synthetics.some(message => message.text.includes(templateText('validation_self_report')))).toBe(false)
  })

  it('nudges a retrospective session without moving it on', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')
    await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1')
    await harness.runTool({ type: 'GOAL_ACHIEVED' }, 'ses_1')
    await harness.runTool({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1')

    const spoken = harness.synthetics.length

    await harness.emit(sessionIdle('ses_1'))

    const nudge = harness.synthetics.slice(spoken).find(message => message.text.includes('idle in `retrospective`'))

    expect(nudge?.text).toContain('RETROSPECTIVE_COMPLETE')
    expect(harness.synthetics.slice(spoken).some(message => message.text.includes(templateText('validation_self_report')))).toBe(false)

    const failure = failureOf(await harness.runTool({ type: 'GOAL_ACHIEVED' }, 'ses_1'))

    expect(failure.metadata).toMatchObject({
      state: 'retrospective',
      available_signals: ['RETROSPECTIVE_COMPLETE'],
    })
  })

  const idlePanics = (harness: Harness): string[] =>
    harness.synthetics
      .map(message => message.text)
      .filter(text => text.includes(templateStart('panic_escalation') + 'idle budget exhausted'))

  it('restores the idle budget when a lesson retries a panicked round', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')

    for (let idle = 0; idle < 4; idle += 1) await harness.emit(sessionIdle('ses_1'))

    expect(idlePanics(harness)).toHaveLength(1)

    await harness.runTool({ type: 'LESSON', payload: { text: 'try differently' } }, 'ses_1')

    const spoken = harness.synthetics.length

    await harness.emit(sessionIdle('ses_1'))

    const nudges = harness.synthetics.slice(spoken)

    expect(nudges).toHaveLength(1)
    expect(nudges[0]?.text).toContain('CLAIM_WORK')

    await harness.emit(sessionIdle('ses_1'))
    await harness.emit(sessionIdle('ses_1'))
    await harness.emit(sessionIdle('ses_1'))

    expect(idlePanics(harness)).toHaveLength(2)
  })

  it('stays parked when more idles arrive', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')
    await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1')
    await harness.runTool({ type: 'GOAL_ACHIEVED' }, 'ses_1')
    await harness.runTool({ type: 'LESSON', payload: { text: 'faster' } }, 'ses_1')
    await harness.runTool({ type: RETROSPECTIVE_COMPLETE }, 'ses_1')

    const spoken = harness.synthetics.length

    await harness.emit(sessionIdle('ses_1'))
    await harness.emit(sessionIdle('ses_1'))
    await harness.emit(sessionIdle('ses_1'))
    await harness.emit(sessionIdle('ses_1'))

    expect(harness.synthetics).toHaveLength(spoken)

    const failure = failureOf(await harness.runTool({ type: 'GOAL_ACHIEVED' }, 'ses_1'))

    expect(failure.metadata).toMatchObject({
      code: 'unavailable_signal',
      signal: 'GOAL_ACHIEVED',
      state: 'parked',
      available_signals: [],
    })
  })
})
