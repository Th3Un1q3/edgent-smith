import { Schema } from 'effect'

import { describe, expect, it } from 'vitest'

import { signalSpec, updateSignalsPolicySpecs } from '@plugins/state-machine/machines/session/definitions'
import { SESSION_MACHINE, TOOL_SIGNALS } from '@plugins/state-machine/core/machine'
import * as signalsModule from '@plugins/state-machine/core/signals'

import type { LoopStateId } from '@plugins/state-machine/core/machine'
import type { SignalRefusal, SignalSpec, SignalTable, SignalValidation, SchemaViolation } from '@plugins/state-machine/core/signals'
import type { UpdateSignalsPolicyParameters } from '@plugins/state-machine/machines/session/definitions'

const sources = SESSION_MACHINE.sources
const registry = SESSION_MACHINE.registry

const specsOf = (parameters: UpdateSignalsPolicyParameters): SignalTable =>
  updateSignalsPolicySpecs(parameters, sources)

const policyOf = (...names: readonly string[]): SignalTable =>
  specsOf({ set_enabled_signals: names, notify_agent: false })

const schemaOf = (spec: SignalSpec | undefined): NonNullable<SignalSpec['schema']> => {
  if (spec?.schema === undefined) throw new Error('expected a declared schema')

  return spec.schema
}

const validate = (input: unknown, signals: SignalTable, state: LoopStateId = 'define_goal'): SignalValidation =>
  signalsModule.validateSignal(input, state, signals, registry)

const refusalOf = (result: SignalValidation): SignalRefusal => {
  if (result.ok) throw new Error('expected a refusal')

  return result.refusal
}

const eventOf = (result: SignalValidation): { readonly type: string, readonly payload?: unknown } => {
  if (!result.ok) throw new Error('expected an event')

  return result.event
}

const violationsOf = (refusal: SignalRefusal): readonly SchemaViolation[] => {
  if (refusal.code !== 'invalid_payload') throw new Error('expected an invalid payload refusal')

  return refusal.schema_validation_error
}

describe('signal declarations', () => {
  it('resolves every vocabulary signal to a declaration', () => {
    const missing = TOOL_SIGNALS.filter(name => registry[name] === undefined)

    expect(missing).toEqual([])
  })

  it('carries no schema on payloadless signals', () => {
    const payloadless = [
      signalSpec('CLAIM_WORK', registry),
      signalSpec('GOAL_ACHIEVED', registry),
      signalSpec('GOAL_INCOMPLETE', registry),
    ]

    expect(payloadless.map(spec => spec.schema)).toEqual([undefined, undefined, undefined])
  })

  it('gives every declared signal a nonblank describe', () => {
    const describes = Object.values(registry).map(spec => spec.describe)

    expect(describes.every(describe => describe.trim() !== '')).toBe(true)
  })

  it('trims SET_GOAL before the event records it', () => {
    const decoded = Schema.decodeUnknownSync(schemaOf(signalSpec('SET_GOAL', registry)))(
      { goal: '  ship  ' },
      { onExcessProperty: 'error' },
    ) as { goal: string }

    expect(decoded.goal).toBe('ship')
  })

  it('rejects a blank SET_GOAL', () => {
    expect(() => Schema.decodeUnknownSync(schemaOf(signalSpec('SET_GOAL', registry)))({ goal: ' '.repeat(3) })).toThrow()
  })

  it('trims LESSON text', () => {
    const decoded = Schema.decodeUnknownSync(schemaOf(signalSpec('LESSON', registry)))({ text: '  lesson  ' }) as { text: string }

    expect(decoded.text).toBe('lesson')
  })

  it.each([
    { name: 'blank', input: { text: ' '.repeat(3) } },
    { name: 'non-string', input: { text: 42 } },
  ])('rejects a $name LESSON text', ({ input }) => {
    expect(() => Schema.decodeUnknownSync(schemaOf(signalSpec('LESSON', registry)))(input)).toThrow()
  })
})

describe('validateSignal', () => {
  it('rejects an unknown name', () => {
    const table = policyOf('SET_GOAL')
    const refusal = refusalOf(validate({ type: 'PUSH_WORK' }, table))
    const expected = [
      'Unknown signal: PUSH_WORK.',
      'Signals now:',
      '- SET_GOAL — State the goal this session must accomplish, in payload.goal.',
    ].join('\n')

    expect(refusal).toEqual({
      code: 'unknown_signal',
      signal: 'PUSH_WORK',
      state: 'define_goal',
      available_signals: ['SET_GOAL'],
    })
    expect(signalsModule.refusalMessage(refusal, table)).toBe(expected)
  })

  it.each([
    'constructor',
    '__proto__',
    'toString',
  ])('refuses the prototype-inherited name %s as unknown', (name) => {
    const refusal = refusalOf(validate({ type: name }, policyOf('SET_GOAL')))

    expect(refusal).toEqual({
      code: 'unknown_signal',
      signal: name,
      state: 'define_goal',
      available_signals: ['SET_GOAL'],
    })
  })

  it('refuses a known signal the current policy does not enable', () => {
    const table = policyOf('SET_GOAL')
    const refusal = refusalOf(validate({ type: 'CLAIM_WORK' }, table))
    const expected = [
      'CLAIM_WORK is not available in define_goal.',
      'Signals now:',
      '- SET_GOAL — State the goal this session must accomplish, in payload.goal.',
    ].join('\n')

    expect(refusal).toEqual({
      code: 'unavailable_signal',
      signal: 'CLAIM_WORK',
      state: 'define_goal',
      available_signals: ['SET_GOAL'],
    })
    expect(signalsModule.refusalMessage(refusal, table)).toBe(expected)
  })

  it('accepts a signal the current policy enables', () => {
    const result = validate({ type: 'CLAIM_WORK' }, policyOf('CLAIM_WORK'), 'work')

    expect(eventOf(result)).toEqual({ type: 'agent_sent_signal.CLAIM_WORK' })
  })

  it('rejects an invalid payload with the path and example', () => {
    const refusal = refusalOf(validate({ type: 'SET_GOAL', payload: { goal: 42 } }, policyOf('SET_GOAL')))

    expect(refusal.code).toBe('invalid_payload')
    expect(refusal).not.toHaveProperty('available_signals')
    expect(violationsOf(refusal)).toEqual([{ path: 'payload.goal', expected: 'string' }])
    expect(signalsModule.refusalMessage(refusal, policyOf('SET_GOAL')))
      .toContain('Example: {"goal":"ship the parser"}')
  })

  it('rejects an excess payload key', () => {
    const refusal = refusalOf(validate({ type: 'SET_GOAL', payload: { goal: 'x', extra: true } }, policyOf('SET_GOAL')))

    expect(violationsOf(refusal))
      .toEqual([{ path: 'payload.extra', expected: 'no excess property' }])
  })

  it('rejects a blank goal at payload.goal', () => {
    const refusal = refusalOf(validate({ type: 'SET_GOAL', payload: { goal: ' '.repeat(3) } }, policyOf('SET_GOAL')))

    expect(violationsOf(refusal)).toEqual([
      { path: 'payload.goal', expected: 'a value with a length of at least 1' },
    ])
  })

  it('rejects an extra top-level key', () => {
    const refusal = refusalOf(validate({ type: 'SET_GOAL', payload: { goal: 'x' }, extra: true }, policyOf('SET_GOAL')))

    expect(violationsOf(refusal))
      .toEqual([{ path: 'extra', expected: 'only type and payload' }])
  })

  it('returns the decoded event for a valid signal', () => {
    const result = validate({ type: 'SET_GOAL', payload: { goal: '  ship  ' } }, policyOf('SET_GOAL'))

    expect(eventOf(result)).toEqual({
      type: 'agent_sent_signal.SET_GOAL',
      payload: { goal: 'ship' },
    })
  })

  it('drops the payload of a payloadless signal', () => {
    const result = validate({ type: 'CLAIM_WORK', payload: { junk: true } }, policyOf('CLAIM_WORK'), 'work')

    expect(eventOf(result)).toEqual({ type: 'agent_sent_signal.CLAIM_WORK' })
  })

  it('lists the policy in its own order after it is updated', () => {
    const work = policyOf('CLAIM_WORK')

    expect(refusalOf(validate({ type: 'GOAL_ACHIEVED' }, work, 'work')))
      .toMatchObject({ available_signals: ['CLAIM_WORK'] })

    const validatePolicy = policyOf('GOAL_INCOMPLETE', 'GOAL_ACHIEVED')
    const refusal = refusalOf(validate({ type: 'CLAIM_WORK' }, validatePolicy, 'validate'))
    const expected = [
      'CLAIM_WORK is not available in validate.',
      'Signals now:',
      '- GOAL_INCOMPLETE — Report that the goal is not met.',
      '- GOAL_ACHIEVED — Report that the goal is met.',
    ].join('\n')

    expect(refusal).toMatchObject({
      code: 'unavailable_signal',
      signal: 'CLAIM_WORK',
      state: 'validate',
      available_signals: ['GOAL_INCOMPLETE', 'GOAL_ACHIEVED'],
    })
    expect(signalsModule.refusalMessage(refusal, validatePolicy)).toBe(expected)
  })

  it('lists no names for a policy that enables none', () => {
    const empty = policyOf()
    const refusal = refusalOf(validate({ type: 'CLAIM_WORK' }, empty))

    expect(refusal).toMatchObject({ available_signals: [] })
    expect(signalsModule.refusalMessage(refusal, empty))
      .toBe('CLAIM_WORK is not available in define_goal.\nSignals now: none')
  })
})

describe('renderSignals', () => {
  it('renders the names the policy enables', () => {
    const text = signalsModule.renderSignals(policyOf('SET_GOAL', 'CLAIM_WORK'))

    expect(text).toContain('- SET_GOAL — State the goal this session must accomplish, in payload.goal.')
    expect(text).toContain('- CLAIM_WORK —')
  })

  it('renders a selected subset in the given order', () => {
    const text = signalsModule.renderSignals(
      policyOf('GOAL_ACHIEVED', 'GOAL_INCOMPLETE'),
      ['GOAL_INCOMPLETE', 'GOAL_ACHIEVED'],
    )

    expect(text.indexOf('GOAL_INCOMPLETE')).toBeLessThan(text.indexOf('GOAL_ACHIEVED'))
  })

  it('omits a name outside the policy', () => {
    expect(signalsModule.renderSignals(policyOf('SET_GOAL'), ['CLAIM_WORK']))
      .toBe('Signals now: none')
  })

  it('renders none for an empty selection', () => {
    expect(signalsModule.renderSignals(policyOf('SET_GOAL'), [])).toBe('Signals now: none')
  })

  it('renders a duplicate key once', () => {
    const text = signalsModule.renderSignals(policyOf('SET_GOAL'), ['SET_GOAL', 'SET_GOAL'])

    expect(text.match(/SET_GOAL/g)).toHaveLength(1)
  })

  it('renders none for an empty policy', () => {
    expect(signalsModule.renderSignals(policyOf())).toBe('Signals now: none')
  })
})

describe('validateSignal refusal details', () => {
  it('reports a missing required field as required', () => {
    const refusal = refusalOf(validate({ type: 'SET_GOAL', payload: {} }, policyOf('SET_GOAL')))

    expect(violationsOf(refusal)).toEqual([{ path: 'payload.goal', expected: 'required' }])
  })

  it('omits violations and example when the refusal carries none', () => {
    const refusal = {
      code: 'invalid_payload',
      signal: 'CUSTOM',
      state: 'define_goal',
      schema_validation_error: [],
    } as const

    expect(signalsModule.refusalMessage(refusal, {})).toBe('CUSTOM payload is invalid in define_goal.')
  })
})

describe('updateSignalsPolicySpecs', () => {
  it('throws for a name the manifest does not declare', () => {
    expect(() => specsOf({ set_enabled_signals: ['PUSH_WORK'], notify_agent: false }))
      .toThrow('which signals.manifest.json does not declare')
  })

  it('throws for an ad-hoc entry with a blank description', () => {
    expect(() => specsOf({
      set_enabled_signals: [{ CUSTOM: { description: '  ' } }],
      notify_agent: false,
    })).toThrow('a blank description')
  })

  it('resolves an ad-hoc entry without a schema to its description', () => {
    const specs = specsOf({
      set_enabled_signals: [{ CUSTOM: { description: 'A custom signal' } }],
      notify_agent: false,
    })

    expect(specs.CUSTOM).toEqual({ describe: 'A custom signal' })
  })

  it('throws for an ad-hoc schema the manifest does not declare', () => {
    expect(() => specsOf({
      set_enabled_signals: [{ CUSTOM: { description: 'A custom signal', schema: 'PUSH_WORK' } }],
      notify_agent: false,
    })).toThrow('which signals.manifest.json does not declare')
  })

  it('resolves a declared schema without a codec to its description', () => {
    const specs = specsOf({
      set_enabled_signals: [{ CUSTOM: { description: 'A custom signal', schema: 'CLAIM_WORK' } }],
      notify_agent: false,
    })

    expect(specs.CUSTOM).toEqual({ describe: 'A custom signal' })
  })

  it('resolves a declared schema to the registry codec', () => {
    const specs = specsOf({
      set_enabled_signals: [{ CUSTOM: { description: 'A custom signal', schema: 'SET_GOAL' } }],
      notify_agent: false,
    })

    expect(specs.CUSTOM?.schema).toBe(registry.SET_GOAL?.schema)
  })

  it('throws for an object entry that names no signal', () => {
    expect(() => specsOf({ set_enabled_signals: [{}], notify_agent: false }))
      .toThrow('names no signal')
  })

  it('throws for a name the registry does not resolve', () => {
    expect(() => signalSpec('PUSH_WORK', registry)).toThrow('neither signals.manifest.json nor machine.json declares')
  })
})
