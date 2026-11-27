import { describe, expect, it } from 'vitest'

import { boot, failureOf } from '@tests/helpers/state-machine/session-loop-fixtures'

import { promptCalls, sessionCreated } from '@tests/helpers/state-machine/harness'

import { stageText } from '@tests/helpers/state-machine/stage-text'

describe('session start', () => {
  it('opens silently in define_goal and asks for the goal once the person speaks', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))

    expect(harness.synthetics).toHaveLength(0)

    await harness.emitUserMessage('ses_1', 'user', 'ship it')

    const texts = harness.synthetics.map(message => message.text)

    const prompts = promptCalls.filter(call => call.text === stageText('goal_request'))

    expect(prompts).toHaveLength(1)
    expect(prompts[0]?.sessionID).toBe('ses_1')
    expect(prompts[0]?.skills.map(skill => skill.id)).toEqual(['progressive-goal-setting'])

    expect(texts).toHaveLength(1)
    expect(texts[0]).toContain('Signals now:')
    expect(texts[0]).toContain('- SET_GOAL — State the goal')
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

    expect(promptCalls.filter(call => call.text.includes(stageText('goal_request')))).toHaveLength(1)
  })
})
