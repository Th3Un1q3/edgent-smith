import { describe, expect, it } from 'vitest'

import { createStateMachine, loadStateMachineLibrary, SESSION_LOOP } from '@plugins/state-machine/core/machine'

import type { LoopContext, LoopEvent, LoopStateId, StateMachineLibrary } from '@plugins/state-machine/core/machine'

const fakeLibrary = (startState: LoopStateId): {
  readonly sent: LoopEvent[]
  readonly library: StateMachineLibrary
} => {
  const sent: LoopEvent[] = []

  return {
    sent,
    library: {
      createActor: (_loop, starting, context) => ({
        send: (event) => { sent.push(event) },
        state: () => startState,
        context: () => context,
        takeEmits: () => [],
      }),
    },
  }
}

const context = (overrides: Partial<LoopContext> = {}): LoopContext => ({
  sessionId: 'ses_1',
  agent: 'rug',
  maxAttempts: 3,
  memoryLimit: 20,
  goal: '',
  intent: 'none',
  attempts: 0,
  idleCount: 0,
  memories: [],
  improvements: [],
  injectedSkills: [],
  injected: {},
  results: {},
  ...overrides,
})

describe('signal payloads', () => {
  it('sends SET_GOAL with the payload nested', () => {
    const fake = fakeLibrary('define_goal')
    const machine = createStateMachine({
      library: fake.library,
      startStateFor: () => 'define_goal',
    })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: '  ship  ' } }, 'ses_1')

    expect(fake.sent).toEqual([
      { type: 'agent_sent_signal.SET_GOAL', payload: { goal: 'ship' } },
    ])
  })

  it('records SET_GOAL from the nested payload', async () => {
    const library = await loadStateMachineLibrary()
    const actor = library.createActor(SESSION_LOOP, 'define_goal', context())

    actor.send({ type: 'agent_sent_signal.SET_GOAL', payload: { goal: 'ship' } })

    expect(actor.state()).toBe('work')
    expect(actor.context().goal).toBe('ship')
  })

  it('pushes a lesson from the nested payload', async () => {
    const library = await loadStateMachineLibrary()
    const actor = library.createActor(SESSION_LOOP, 'memorize', context({ intent: 'lesson' }))

    actor.send({ type: 'agent_sent_signal.LESSON', payload: { text: 'lesson' } })

    expect(actor.state()).toBe('work')
    expect(actor.context().memories).toEqual(['lesson'])
  })

  it('reads field_present from the nested payload', async () => {
    const library = await loadStateMachineLibrary()
    const actor = library.createActor(SESSION_LOOP, 'panic', context())

    actor.send({ type: 'agent_sent_signal.LESSON', payload: { text: 'retry' } })

    expect(actor.state()).toBe('work')
  })

  it('keeps callback payloads working', async () => {
    const library = await loadStateMachineLibrary()
    const actor = library.createActor(SESSION_LOOP, 'check', context())

    actor.send({ type: 'callback.quality_check_ready', payload: { ok: true } })

    expect(actor.state()).toBe('validate')
  })
})
