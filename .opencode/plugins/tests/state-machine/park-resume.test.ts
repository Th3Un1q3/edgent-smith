import { describe, expect, it } from 'vitest'

import { sessionCreated, sessionInterrupted } from '@tests/helpers/state-machine/harness'
import { boot } from '@tests/helpers/state-machine/session-loop-fixtures'
import { stageStart } from '@tests/helpers/state-machine/stage-text'

interface Synthetic {
  readonly text: string
  readonly description?: string
}

const parkSummaries = (messages: readonly Synthetic[]): readonly Synthetic[] =>
  messages.filter(message => message.text.startsWith(stageStart('park_summary')))

/**
The claim is that the description names the two slots a parked reader needs: an
action the user performs and the loop continuing. Each slot accepts any synonym,
so a wording edit moves the sentence without reddening the suite; an absent slot
still fails.
*/
const USER_ACTION
  = /\b(send|sent|sending|reply|replies|replied|replying|respond\w*|answer\w*|message\w*|messaged|messaging|type|typed|typing|write|wrote|writing|say|said|saying|tell|told|telling|ask\w*|instruct\w*|request\w*|submit\w*|post\w*|input|enter\w*|provide\w*|give|gave|giving|drop\w*|ping\w*|text\w*|chat\w*|talk\w*|speak\w*|comment\w*|prompt\w*)\b/i

const RESUMES
  = /\b(resum\w*|restart\w*|continu\w*|carry on|pick\b[^.]{0,24}\bup|proceed\w*|return\w*|come back|keep going|go on|get going|start over|start again|begin again|back to work)\b/i

const isResumeActionNamed = (text: string): boolean => USER_ACTION.test(text) && RESUMES.test(text)

describe('the resume-claim predicate', () => {
  it.each([
    'Send a new message to resume the loop from a fresh goal.',
    'Reply when you want the work to continue.',
    'Write your next instruction to pick the loop back up.',
    'Say the word and we get going on the next goal.',
  ])('accepts wording that names a user action and a resumption: %s', (wording) => {
    expect(isResumeActionNamed(wording)).toBe(true)
  })

  it.each([
    '',
    'Goal reached with improvements listed above.',
    'The loop continues on its own.',
    'Send a summary of the work.',
  ])('rejects wording missing a slot: %s', (wording) => {
    expect(isResumeActionNamed(wording)).toBe(false)
  })
})

describe('the parked summary', () => {
  it('tells the person what resumes the loop after an interruption', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')

    const beforeInterrupt = harness.synthetics.length

    await harness.emit(sessionInterrupted('ses_1', 'user'))

    const summaries = parkSummaries(harness.synthetics.slice(beforeInterrupt))

    expect(summaries).toHaveLength(1)

    const description = summaries[0]?.description ?? ''

    expect(description.trim()).not.toBe('')
    expect(isResumeActionNamed(description)).toBe(true)
  })

  it('sends no parked summary before an interruption parks the loop', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')
    await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1')

    expect(parkSummaries(harness.synthetics)).toHaveLength(0)
  })
})
