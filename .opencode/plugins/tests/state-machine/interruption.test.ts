import { describe, expect, it } from 'vitest'

import { boot, failureOf, PARKED_PROMPT } from '@tests/helpers/state-machine/session-loop-fixtures'

import { sessionCreated, sessionInterrupted } from '@tests/helpers/state-machine/harness'

import { templateEnd } from '@tests/helpers/state-machine/template-text'

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
      available_signals: [],
    })
    expect(failure.message).toContain('GOAL_ACHIEVED is not available in parked.')
    expect(failure.message).toContain('Signals now: none')
    expect(failure.message).not.toContain('CLAIM_WORK')

    const parked = harness.synthetics.reduce<(typeof harness.synthetics)[number] | undefined>(
      (last, message) => (message.description === PARKED_PROMPT ? message : last),
      undefined,
    )

    expect(parked?.text).toContain(templateEnd('park_summary'))
    expect(parked?.description).toBe(PARKED_PROMPT)
  })

  it('ignores an interruption for a session the loop never opened', async () => {
    const harness = await boot()

    await harness.emit(sessionInterrupted('ses_ghost', 'shutdown'))
    await harness.emit(sessionInterrupted('ses_ghost', 'shutdown'))

    expect(harness.synthetics).toHaveLength(0)
  })
})
