import { describe, expect, it } from 'vitest'

import {
  createActions,
  createGuards,
  declaredPolicyParameters,
  promptDescription,
  renderTemplate,
} from '@plugins/state-machine/machines/session/definitions'

import { signalEvent } from '@plugins/state-machine/core/machine'

import type { LoopContext, LoopEvent } from '@plugins/state-machine/core/machine'
import type { XStateRuntime } from '@plugins/state-machine/machines/session/definitions'

const context = (overrides: Record<string, unknown> = {}): LoopContext => ({
  goal: 'ship it',
  attempts: 0,
  intent: 'none',
  memories: [],
  improvements: [],
  memoryLimit: 3,
  injected: {},
  injectedSkills: [],
  results: {},
  signalsPolicy: { names: [] },
  ...overrides,
} as unknown as LoopContext)

const runtime = {
  assign: <T>(action: T): T => action,
  emit: <T>(action: T): T => action,
  enqueueActions: <T>(action: T): T => action,
  not: (value: unknown): unknown => value,
  stateIn: (): unknown => ({}),
} as unknown as XStateRuntime

type Action = (arguments_: unknown, parameters: unknown) => unknown

const call = (action: unknown, arguments_: unknown, parameters: unknown): unknown =>
  (action as Action)(arguments_, parameters)

const actions = createActions(runtime, { signals: {}, codecs: {} })

const record = (parameters: unknown, event: LoopEvent, base: LoopContext = context()): unknown =>
  call(actions.record, { context: base, event }, parameters)

describe('promptDescription', () => {
  it('names an emit that supplies no description by its opening words', () => {
    expect(promptDescription({ text: 'Verdict: call signal_send with type GOAL_ACHIEVED' }))
      .toBe('Sent synthetic message: Verdict: call signal...')
  })

  it('keeps the description the action supplied', () => {
    expect(promptDescription({ text: 'Verdict: call signal_send', description: 'Judge the goal' }))
      .toBe('Judge the goal')
  })
})

describe('failure templates', () => {
  it('names an unknown quality-check reason and omits a missing detail', () => {
    const text = renderTemplate({ template: 'quality_check_failed' }, context())

    expect(text).toBe('Quality check failed: unknown. Parked in panic for investigation.')
  })

  it('renders the quality-check reason and its detail when both exist', () => {
    const text = renderTemplate(
      { template: 'quality_check_failed' },
      context({ failure: { reason: 'exit 1', detail: 'type error' } }),
    )

    expect(text).toBe('Quality check failed: exit 1 (type error). Parked in panic for investigation.')
  })

  it('names an unknown escalation reason and omits a missing detail', () => {
    expect(renderTemplate({ template: 'panic_escalation' }, context()))
      .toBe('Parked for investigation: unknown')
  })

  it('renders the escalation reason and its detail when both exist', () => {
    expect(renderTemplate(
      { template: 'panic_escalation' },
      context({ failure: { reason: 'attempts exhausted', detail: 'three tries' } }),
    )).toBe('Parked for investigation: attempts exhausted (three tries)')
  })
})

describe('record action', () => {
  it('reads nothing from a payload that is not an object', () => {
    const next = record(
      { op: 'set', key: 'goal', source: { from: 'payload', field: 'goal' } },
      { type: 'SET_GOAL', payload: 'not-an-object' } as unknown as LoopEvent,
    )

    expect(next).toEqual({ goal: '' })
  })

  it('reads a non-string field as empty text', () => {
    const next = record(
      { op: 'set', key: 'goal', source: { from: 'payload', field: 'goal' } },
      { type: 'SET_GOAL', payload: { goal: 7 } } as unknown as LoopEvent,
    )

    expect(next).toEqual({ goal: '' })
  })

  it('ignores a push whose source is not text', () => {
    const next = record(
      { op: 'push', key: 'memories', source: { from: 'literal', value: 9 } },
      { type: signalEvent('LESSON') },
    )

    expect(next).toEqual({})
  })

  it('drops pushed text when the memory limit is zero', () => {
    const next = record(
      { op: 'push', key: 'improvements', source: { from: 'literal', value: 'faster' } },
      { type: signalEvent('LESSON') },
      context({ memoryLimit: 0, improvements: ['older'] }),
    )

    expect(next).toEqual({ improvements: [] })
  })

  it('keeps each context field when the incoming value has the wrong type', () => {
    const base = context({ intent: 'lesson', attempts: 2, goal: 'kept' })

    expect(record(
      { op: 'set', key: 'intent', source: { from: 'literal', value: 'unknown-intent' } },
      { type: signalEvent('LESSON') },
      base,
    )).toEqual({ intent: 'lesson' })
    expect(record(
      { op: 'set', key: 'attempts', source: { from: 'literal', value: 'two' } },
      { type: signalEvent('LESSON') },
      base,
    )).toEqual({ attempts: 2 })
    expect(record(
      { op: 'set', key: 'goal', source: { from: 'literal', value: 11 } },
      { type: signalEvent('LESSON') },
      base,
    )).toEqual({ goal: 'kept' })
  })

  it('records a callback with no object payload as a failure', () => {
    const next = call(
      actions.record_callback,
      { context: context(), event: { type: 'x', payload: 'not-an-object' } },
      { reportTo: 'quality_check_ready' },
    ) as { results: Record<string, unknown>, failure?: { reason: string } }

    expect(next.results.quality_check_ready).toEqual({ ok: false })
    expect(next.failure?.reason).toBe('quality_check_ready failed')
  })

  it('keeps one skill marker when the skill is marked twice', () => {
    const base = context({ injectedSkills: ['skill:task-delegation:complete'] })
    const next = call(actions.mark_skill, { context: base }, { name: 'task-delegation' }) as {
      injectedSkills: readonly string[]
    }

    expect(next.injectedSkills).toEqual(['skill:task-delegation:complete'])
  })
})

describe('session_agent guard', () => {
  const guards = createGuards(runtime)

  const admits = (arguments_: unknown, allowed: readonly string[]): unknown =>
    (guards.session_agent as (guardArguments: unknown, parameters: unknown) => unknown)(arguments_, { in: allowed })

  it('reads the identity the admit event carries when the event is one', () => {
    const event = { type: 'admit', agent: 'rug', parentID: undefined }

    expect(admits({ context: context({ agent: '' }), event }, ['rug'])).toBe(true)
  })

  it('refuses a loop agent whose admit event names a parent', () => {
    const event = { type: 'admit', agent: 'rug', parentID: 'ses_parent' }

    expect(admits({ context: context({ agent: 'rug' }), event }, ['rug'])).toBe(false)
  })
})

describe('declaredPolicyParameters', () => {
  const policy = { type: 'update_signals_policy', params: { set_enabled_signals: ['CLAIM_WORK'] } }

  it('reads no policy from a definition that is not an object', () => {
    expect(declaredPolicyParameters(undefined)).toEqual([])
    expect(declaredPolicyParameters({ states: 'not-an-object' })).toEqual([])
  })

  it('reads no policy from an entry that is not a policy action', () => {
    expect(declaredPolicyParameters({
      states: {
        a: { entry: undefined },
        b: { entry: 5 },
        c: { entry: { type: 'prompt', params: {} } },
      },
    })).toEqual([])
  })

  it('skips a policy action whose parameters are not a signal list', () => {
    expect(declaredPolicyParameters({
      states: {
        a: { entry: { type: 'update_signals_policy', params: null } },
        b: { entry: { type: 'update_signals_policy', params: { set_enabled_signals: 'CLAIM_WORK' } } },
      },
    })).toEqual([])
  })

  it('skips a state that is not an object and one whose arms are not an object', () => {
    expect(declaredPolicyParameters({
      states: {
        a: 7,
        b: { on: 'not-an-object' },
      },
    })).toEqual([])
  })

  it('reads a single-object arm and an array arm, ignoring non-object entries', () => {
    const single = declaredPolicyParameters({
      states: { a: { on: { single: { actions: policy } } } },
    })
    const many = declaredPolicyParameters({
      states: { a: { on: { many: [{ actions: policy }, 5] } } } },
    )

    expect(single).toEqual([{ set_enabled_signals: ['CLAIM_WORK'], notify_agent: undefined }])
    expect(many).toEqual([{ set_enabled_signals: ['CLAIM_WORK'], notify_agent: undefined }])
  })

  it('reads policy from both entry and exit lists', () => {
    const found = declaredPolicyParameters({
      states: { a: { entry: [policy], exit: [policy] } },
    })

    expect(found).toHaveLength(2)
  })
})
