import { describe, expect, it } from 'vitest'

import { loadStateMachineLibrary, SESSION_LOOP } from '@plugins/state-machine/core/machine'
import { freshContext } from '@plugins/state-machine/machines/session/context'

import type { Actor } from '@plugins/state-machine/core/machine'

const actorFor = async (agent: string, parentID?: string): Promise<Actor> => {
  const library = await loadStateMachineLibrary()

  return library.createActor(
    SESSION_LOOP,
    'admission',
    freshContext({ sessionId: 'ses_1', agent, parentID }),
  )
}

describe('admission entry', () => {
  it('admits a subagent session to free_work from the context identity', async () => {
    const actor = await actorFor('rug-swe', 'ses_parent')

    expect(actor.state()).toBe('free_work')
  })

  it('keeps a subagent session in free_work through host events and signals', async () => {
    const actor = await actorFor('rug-swe', 'ses_parent')

    actor.send({ type: 'system_idle' })
    expect(actor.state()).toBe('free_work')

    actor.send({ type: 'system_interrupted', reason: 'user' })
    expect(actor.state()).toBe('free_work')

    actor.send({ type: 'system_user_input', text: 'hello' })
    expect(actor.state()).toBe('free_work')

    actor.send({ type: 'agent_sent_signal.CLAIM_WORK' })
    expect(actor.state()).toBe('free_work')
  })

  it('starts a loop agent with no parent at define_goal', async () => {
    const actor = await actorFor('rug')

    expect(actor.state()).toBe('define_goal')
  })

  it('keeps a loop agent with a parent in free_work', async () => {
    const actor = await actorFor('rug', 'ses_parent')

    expect(actor.state()).toBe('free_work')
  })

  it('leaves a session with no agent in free_work immediately', async () => {
    const actor = await actorFor('')

    expect(actor.state()).toBe('free_work')
  })
})
