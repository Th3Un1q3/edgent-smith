import { describe, expect, it } from 'vitest'

import { createStateMachine, loadStateMachineLibrary, SESSION_LOOP } from '@plugins/state-machine/core/machine'

import type { LoopContext, LoopDefinition, LoopEvent, LoopStateId, StateMachineLibrary } from '@plugins/state-machine/core/machine'

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
        context: () => ({ ...context, signalsPolicy: { names: ['SET_GOAL'] } }),
        takeEmits: () => [],
        persistedSnapshot: () => ({}),
      }),
    },
  }
}

const context = (overrides: Partial<LoopContext> = {}): LoopContext => ({
  nudges: 0,
  sessionId: 'ses_1',
  agent: 'rug',
  maxAttempts: 3,
  memoryLimit: 20,
  goal: '',
  intent: 'none',
  attempts: 0,
  memories: [],
  improvements: [],
  injectedSkills: [],
  injected: {},
  results: {},
  ...overrides,
})

const loopAt = (leaf: string): LoopDefinition => ({
  ...SESSION_LOOP,
  states: { ...SESSION_LOOP.states, towards_goal: { ...SESSION_LOOP.states.towards_goal, initial: leaf } },
})

describe('signal payloads', () => {
  it('sends SET_GOAL with the payload nested', () => {
    const fake = fakeLibrary('define_goal')
    const machine = createStateMachine({
      library: fake.library,
    })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: '  ship  ' } }, 'ses_1')

    expect(fake.sent).toEqual([
      { type: 'admit', agent: 'rug', parentID: undefined },
      { type: 'agent_sent_signal.SET_GOAL', payload: { goal: 'ship' } },
    ])
  })

  it('records SET_GOAL from the nested payload', async () => {
    const library = await loadStateMachineLibrary()
    const actor = library.createActor(loopAt('define_goal'), 'towards_goal', context())

    actor.send({ type: 'agent_sent_signal.SET_GOAL', payload: { goal: 'ship' } })

    expect(actor.state()).toBe('work')
    expect(actor.context().goal).toBe('ship')
  })

  it('pushes a lesson from the nested payload', async () => {
    const library = await loadStateMachineLibrary()
    const actor = library.createActor(loopAt('memorize'), 'towards_goal', context({ intent: 'lesson' }))

    actor.send({ type: 'agent_sent_signal.LESSON', payload: { text: 'lesson' } })
    actor.send({ type: 'agent_sent_signal.RETROSPECTIVE_COMPLETE' })

    expect(actor.state()).toBe('work')
    expect(actor.context().memories).toEqual(['lesson'])
  })

  it('reads field_present from the nested payload', async () => {
    const library = await loadStateMachineLibrary()
    const actor = library.createActor(loopAt('panic'), 'towards_goal', context())

    actor.send({ type: 'agent_sent_signal.LESSON', payload: { text: 'retry' } })

    expect(actor.state()).toBe('work')
  })

  it('keeps callback payloads working', async () => {
    const library = await loadStateMachineLibrary()
    const actor = library.createActor(loopAt('check'), 'towards_goal', context())

    actor.send({ type: 'callback.quality_check_ready', payload: { ok: true } })

    expect(actor.state()).toBe('validate')
  })
})
