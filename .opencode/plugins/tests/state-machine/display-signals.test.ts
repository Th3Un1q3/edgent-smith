import { describe, expect, it } from 'vitest'

import { signalSpec, updateSignalsPolicySpecs } from '@plugins/state-machine/machines/session/definitions'
import { createStateMachine, loadStateMachineLibrary, SESSION_LOOP, SESSION_MACHINE } from '@plugins/state-machine/core/machine'
import { renderSignals, validateSignal } from '@plugins/state-machine/core/signals'

import type { UpdateSignalsPolicyParameters } from '@plugins/state-machine/machines/session/definitions'
import type { Actor, LoopContext, LoopDefinition, LoopStateId } from '@plugins/state-machine/core/machine'
import type { SignalTable, SignalValidation } from '@plugins/state-machine/core/signals'

import { makeHarness, register, sessionCreated } from '@tests/helpers/state-machine-harness'

import type { Harness } from '@tests/helpers/state-machine-harness'

const boot = async (): Promise<Harness> => {
  const harness = makeHarness()

  await register(harness)
  return harness
}

const sources = SESSION_MACHINE.sources
const registry = SESSION_MACHINE.registry

const specsOf = (parameters: UpdateSignalsPolicyParameters): SignalTable =>
  updateSignalsPolicySpecs(parameters, sources)

const validate = (input: unknown, state: LoopStateId, signals: SignalTable): SignalValidation =>
  validateSignal(input, state, signals, registry)

const policyOf = (...names: readonly string[]): SignalTable =>
  specsOf({ set_enabled_signals: names, notify_agent: false })

const startedContext = async (): Promise<LoopContext> => {
  const library = await loadStateMachineLibrary()
  const machine = createStateMachine({
    library,
  })

  machine.start('ses_1', 'rug')
  machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

  const context = machine.get('ses_1')?.context

  if (context === undefined) throw new Error('the started machine has no context')

  return context
}

const workActor = async (parameters: UpdateSignalsPolicyParameters): Promise<Actor> => {
  const library = await loadStateMachineLibrary()
  const custom: LoopDefinition = {
    ...SESSION_LOOP,
    states: {
      ...SESSION_LOOP.states,
      work: {
        ...SESSION_LOOP.states.work,
        entry: [{ type: 'update_signals_policy', params: parameters }],
      },
    },
  }

  return library.createActor(custom, 'work', await startedContext())
}

const updateGoal: UpdateSignalsPolicyParameters = {
  set_enabled_signals: [{ UPDATE_GOAL: { description: 'update goal', schema: 'SET_GOAL' } }],
  notify_agent: true,
}

describe('update_signals_policy', () => {
  it('advertises the work signal after SET_GOAL', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    const signals = harness.synthetics.filter(message => message.text.includes('Signals now:'))

    expect(signals.at(-1)?.text).toContain('- CLAIM_WORK —')
  })

  it('enables exactly the one signal a string entry names', async () => {
    const actor = await workActor({ set_enabled_signals: ['CLAIM_WORK'], notify_agent: true })

    expect(actor.takeEmits()).toEqual([{ type: 'emit.signals', signal_keys: ['CLAIM_WORK'] }])
    expect(actor.context().signalsPolicy).toEqual({ names: ['CLAIM_WORK'] })
  })

  it('advertises an ad-hoc UPDATE_GOAL with its own description', async () => {
    const actor = await workActor(updateGoal)
    const specs = specsOf(updateGoal)

    expect(actor.takeEmits()).toEqual([{ type: 'emit.signals', signal_keys: ['UPDATE_GOAL'] }])
    expect(renderSignals(specs)).toBe('Signals now:\n- UPDATE_GOAL — update goal')
    expect(specs.UPDATE_GOAL?.schema).toBe(signalSpec('SET_GOAL', registry).schema)
  })

  it('accepts UPDATE_GOAL when the borrowed SET_GOAL schema admits its payload', () => {
    const specs = specsOf(updateGoal)

    expect(validate({ type: 'UPDATE_GOAL', payload: { goal: 'ship the iterator' } }, 'work', specs)).toEqual({
      ok: true,
      event: { type: 'agent_sent_signal.UPDATE_GOAL', payload: { goal: 'ship the iterator' } },
    })
  })

  it('refuses UPDATE_GOAL with the refusal a bad SET_GOAL payload earns', () => {
    const specs = specsOf(updateGoal)
    const refusal = validate({ type: 'UPDATE_GOAL', payload: { goal: '' } }, 'work', specs)
    const setGoal = validate({ type: 'SET_GOAL', payload: { goal: '' } }, 'define_goal', policyOf('SET_GOAL'))

    if (refusal.ok || setGoal.ok) throw new Error('expected both payloads to be refused')

    expect(refusal.refusal).toEqual({
      ...setGoal.refusal,
      signal: 'UPDATE_GOAL',
      state: 'work',
    })
  })

  it('enables the set without an advert when notify_agent is false', async () => {
    const actor = await workActor({ set_enabled_signals: ['CLAIM_WORK'], notify_agent: false })

    expect(actor.takeEmits()).toEqual([])
    expect(actor.context().signalsPolicy).toEqual({ names: ['CLAIM_WORK'] })
  })

  it('keeps the policy in force when a later state sets none', async () => {
    const library = await loadStateMachineLibrary()
    const machine = createStateMachine({
      library,
    })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')

    expect(machine.state('ses_1')).toBe('check')
    expect(machine.signalLine('ses_1')).toBe('Signals now:\n- CLAIM_WORK — Say the work is done and ready for the quality check.')
    expect(machine.signal({ type: 'CLAIM_WORK' }, 'ses_1').refusal).toBeUndefined()
  })

  it('advertises and accepts both entries of a mixed policy list', async () => {
    const mixed: UpdateSignalsPolicyParameters = {
      set_enabled_signals: ['SET_GOAL', { UPDATE_GOAL: { description: 'update goal', schema: 'SET_GOAL' } }],
      notify_agent: true,
    }
    const actor = await workActor(mixed)
    const specs = specsOf(mixed)
    const advert = renderSignals(specs, ['SET_GOAL', 'UPDATE_GOAL'])

    expect(actor.takeEmits()).toEqual([{ type: 'emit.signals', signal_keys: ['SET_GOAL', 'UPDATE_GOAL'] }])
    expect(advert.indexOf('- SET_GOAL —')).toBeLessThan(advert.indexOf('- UPDATE_GOAL — update goal'))
    expect(validate({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'work', specs)).toEqual({
      ok: true,
      event: { type: 'agent_sent_signal.SET_GOAL', payload: { goal: 'ship it' } },
    })
    expect(validate({ type: 'UPDATE_GOAL', payload: { goal: 'ship it' } }, 'work', specs)).toEqual({
      ok: true,
      event: { type: 'agent_sent_signal.UPDATE_GOAL', payload: { goal: 'ship it' } },
    })
    expect(validate({ type: 'UPDATE_GOAL', payload: { goal: '' } }, 'work', specs))
      .toMatchObject({ ok: false, refusal: { code: 'invalid_payload', signal: 'UPDATE_GOAL' } })
  })

  it('refuses a whitespace-only goal exactly as SET_GOAL does', () => {
    const specs = specsOf(updateGoal)
    const refusal = validate({ type: 'UPDATE_GOAL', payload: { goal: ' '.repeat(3) } }, 'work', specs)
    const setGoal = validate({ type: 'SET_GOAL', payload: { goal: ' '.repeat(3) } }, 'define_goal', policyOf('SET_GOAL'))

    if (refusal.ok || setGoal.ok) throw new Error('expected both payloads to be refused')

    expect(refusal.refusal).toEqual({
      ...setGoal.refusal,
      signal: 'UPDATE_GOAL',
      state: 'work',
    })
  })

  it('advertises none when set_enabled_signals is empty', async () => {
    const empty: UpdateSignalsPolicyParameters = {
      set_enabled_signals: [],
      notify_agent: true,
    }
    const actor = await workActor(empty)
    const specs = specsOf(empty)

    expect(actor.takeEmits()).toEqual([{ type: 'emit.signals', signal_keys: [] }])
    expect(actor.context().signalsPolicy).toEqual({ names: [] })
    expect(renderSignals(specs)).toBe('Signals now: none')
    expect(renderSignals(policyOf('CLAIM_WORK'), ['CLAIM_WORK'])).toContain('- CLAIM_WORK —')
  })
})
