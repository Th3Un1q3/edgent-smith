import { describe, expect, it } from 'vitest'

import { createStateMachine, loadStateMachineLibrary, readStartConfig, SESSION_LOOP } from '@plugins/state-machine/core/machine'

import type { LoopDefinition } from '@plugins/state-machine/core/machine'

import { makeHarness, register, sessionCreated } from '@tests/helpers/state-machine-harness'

import type { Harness } from '@tests/helpers/state-machine-harness'

const boot = async (): Promise<Harness> => {
  const harness = makeHarness()

  await register(harness)
  return harness
}

describe('display_signals', () => {
  it('advertises the work signal after SET_GOAL', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    const signals = harness.synthetics.filter(message => message.text.includes('Signals now:'))

    expect(signals.at(-1)?.text).toContain('- CLAIM_WORK —')
  })

  it('emits the selected keys', async () => {
    const library = await loadStateMachineLibrary()
    const machine = createStateMachine({
      library,
      startStateFor: readStartConfig({ rug: 'define_goal' }).startStateFor,
    })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    const context = machine.get('ses_1')?.context

    if (context === undefined) throw new Error('the started machine has no context')

    const custom: LoopDefinition = {
      ...SESSION_LOOP,
      states: {
        ...SESSION_LOOP.states,
        work: {
          ...SESSION_LOOP.states.work,
          entry: [{ type: 'display_signals', params: { signal_keys: ['CLAIM_WORK'] } }],
        },
      },
    }
    const actor = library.createActor(custom, 'work', context)

    expect(actor.takeEmits()).toEqual([{ type: 'emit.signals', signal_keys: ['CLAIM_WORK'] }])
  })
})
