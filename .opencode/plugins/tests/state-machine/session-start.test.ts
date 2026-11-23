import { describe, expect, it } from 'vitest'

import { boot, failureOf } from '@tests/helpers/state-machine/session-loop-fixtures'

import { sessionCreated } from '@tests/helpers/state-machine/harness'

import { templateText } from '@tests/helpers/state-machine/template-text'

describe('session start', () => {
  it('opens silently in define_goal and asks for the goal once the person speaks', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))

    expect(harness.synthetics).toHaveLength(0)

    await harness.emitUserMessage('ses_1', 'user', 'ship it')

    const texts = harness.synthetics.map(message => message.text)

    expect(texts).toHaveLength(2)
    expect(texts[0]).toContain(templateText('goal_request'))
    expect(texts[1]).toContain('Signals now:')
    expect(texts[1]).toContain('- SET_GOAL — State the goal')
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

    expect(harness.synthetics.filter(message => message.text.includes(templateText('goal_request')))).toHaveLength(1)
  })
})
