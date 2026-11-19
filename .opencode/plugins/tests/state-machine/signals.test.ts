import { Schema } from 'effect'

import { describe, expect, it } from 'vitest'

import { LOOP_STATE_IDS, SESSION_LOOP } from '@plugins/state-machine/core/machine'
import * as signalsModule from '@plugins/state-machine/core/signals'

import type { LoopDefinition, LoopState, LoopStateId } from '@plugins/state-machine/core/machine'
import type { SignalRefusal, SignalSpec, SignalTable, SignalValidation, SchemaViolation } from '@plugins/state-machine/core/signals'

const specsFor = (state: LoopStateId): Readonly<Partial<Record<string, SignalSpec>>> =>
  SESSION_LOOP.states[state].signals

const schemaOf = (spec: SignalSpec | undefined): NonNullable<SignalSpec['schema']> => {
  if (spec?.schema === undefined) throw new Error('expected a declared schema')

  return spec.schema
}

const validate = (input: unknown, state: LoopStateId = 'define_goal'): SignalValidation =>
  signalsModule.validateSignal(input, state, specsFor(state))

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

const loopWith = (patch: Partial<Record<LoopStateId, LoopState>>): LoopDefinition => ({
  ...SESSION_LOOP,
  states: { ...SESSION_LOOP.states, ...patch },
})

describe('signal declarations', () => {
  it('declares an empty signals block on states without agent signals', () => {
    expect(SESSION_LOOP.states.check.signals).toEqual({})
    expect(SESSION_LOOP.states.parked.signals).toEqual({})
  })

  it('declares SET_GOAL on define_goal and CLAIM_WORK on work', () => {
    expect(Object.keys(specsFor('define_goal'))).toEqual(['SET_GOAL'])
    expect(Object.keys(specsFor('work'))).toEqual(['CLAIM_WORK'])
  })

  it('declares the two verdicts on validate in order', () => {
    expect(Object.keys(specsFor('validate'))).toEqual(['GOAL_ACHIEVED', 'GOAL_INCOMPLETE'])
  })

  it('declares LESSON on memorize and panic', () => {
    expect(Object.keys(specsFor('memorize'))).toEqual(['LESSON'])
    expect(Object.keys(specsFor('panic'))).toEqual(['LESSON'])
  })

  it('carries no schema on payloadless signals', () => {
    const payloadless = [
      specsFor('work').CLAIM_WORK,
      specsFor('validate').GOAL_ACHIEVED,
      specsFor('validate').GOAL_INCOMPLETE,
    ]

    expect(payloadless.map(spec => spec?.schema)).toEqual([undefined, undefined, undefined])
  })

  it('gives every declared signal a nonblank describe', () => {
    const describes = LOOP_STATE_IDS.flatMap(state =>
      Object.values(specsFor(state)).map(spec => spec?.describe ?? ''))

    expect(describes.every(describe => describe.trim() !== '')).toBe(true)
  })

  it('trims SET_GOAL before the event records it', () => {
    const decoded = Schema.decodeUnknownSync(schemaOf(specsFor('define_goal').SET_GOAL))(
      { goal: '  ship  ' },
      { onExcessProperty: 'error' },
    ) as { goal: string }

    expect(decoded.goal).toBe('ship')
  })

  it('rejects a blank SET_GOAL', () => {
    expect(() => Schema.decodeUnknownSync(schemaOf(specsFor('define_goal').SET_GOAL))({ goal: ' '.repeat(3) })).toThrow()
  })

  it('trims LESSON text in memorize', () => {
    const decoded = Schema.decodeUnknownSync(schemaOf(specsFor('memorize').LESSON))({ text: '  lesson  ' }) as { text: string }

    expect(decoded.text).toBe('lesson')
  })

  it.each([
    { name: 'blank', input: { text: ' '.repeat(3) } },
    { name: 'non-string', input: { text: 42 } },
  ])('rejects a $name LESSON text in panic', ({ input }) => {
    expect(() => Schema.decodeUnknownSync(schemaOf(specsFor('panic').LESSON))(input)).toThrow()
  })
})

describe('validateSignal', () => {
  it('rejects an unknown name and lists the vocabulary', () => {
    const refusal = refusalOf(validate({ type: 'PUSH_WORK' }))

    expect(refusal.code).toBe('unknown_signal')
    expect(signalsModule.refusalMessage(refusal, specsFor('define_goal')))
      .toContain('Signals: SET_GOAL, CLAIM_WORK')
  })

  it('rejects a known signal the state does not declare', () => {
    const refusal = refusalOf(validate({ type: 'CLAIM_WORK' }))

    expect(refusal.code).toBe('unavailable_signal')
    expect(refusal.available_signals).toEqual(['SET_GOAL'])
    expect(signalsModule.refusalMessage(refusal, specsFor('define_goal')))
      .toContain('- SET_GOAL — State the goal')
  })

  it('rejects an invalid payload with the path and example', () => {
    const refusal = refusalOf(validate({ type: 'SET_GOAL', payload: { goal: 42 } }))

    expect(refusal.code).toBe('invalid_payload')
    expect(violationsOf(refusal)).toEqual([{ path: 'payload.goal', expected: 'string' }])
    expect(signalsModule.refusalMessage(refusal, specsFor('define_goal')))
      .toContain('Example: {"goal":"ship the parser"}')
  })

  it('rejects an excess payload key', () => {
    const refusal = refusalOf(validate({ type: 'SET_GOAL', payload: { goal: 'x', extra: true } }))

    expect(violationsOf(refusal))
      .toEqual([{ path: 'payload.extra', expected: 'no excess property' }])
  })

  it('rejects a blank goal at payload.goal', () => {
    const refusal = refusalOf(validate({ type: 'SET_GOAL', payload: { goal: ' '.repeat(3) } }))

    expect(violationsOf(refusal)).toEqual([
      { path: 'payload.goal', expected: 'a value with a length of at least 1' },
    ])
  })

  it('rejects an extra top-level key', () => {
    const refusal = refusalOf(validate({ type: 'SET_GOAL', payload: { goal: 'x' }, extra: true }))

    expect(violationsOf(refusal))
      .toEqual([{ path: 'extra', expected: 'only type and payload' }])
  })

  it('returns the decoded event for a valid signal', () => {
    expect(eventOf(validate({ type: 'SET_GOAL', payload: { goal: '  ship  ' } }))).toEqual({
      type: 'agent_sent_signal.SET_GOAL',
      payload: { goal: 'ship' },
    })
  })

  it('drops the payload of a payloadless signal', () => {
    expect(eventOf(validate({ type: 'CLAIM_WORK', payload: { junk: true } }, 'work')))
      .toEqual({ type: 'agent_sent_signal.CLAIM_WORK' })
  })
})

describe('assertSignalDeclarations', () => {
  it('accepts the shipped loop', () => {
    expect(() => signalsModule.assertSignalDeclarations(SESSION_LOOP)).not.toThrow()
  })

  it('rejects an arm with no declaration', () => {
    const loop = loopWith({ define_goal: { ...SESSION_LOOP.states.define_goal, signals: {} } })

    expect(() => signalsModule.assertSignalDeclarations(loop)).toThrow(/define_goal.*SET_GOAL/)
  })

  it('rejects a declaration with no arm', () => {
    const loop = loopWith({
      define_goal: {
        ...SESSION_LOOP.states.define_goal,
        signals: {
          ...SESSION_LOOP.states.define_goal.signals,
          CLAIM_WORK: { describe: 'Say the work is done.' },
        },
      },
    })

    expect(() => signalsModule.assertSignalDeclarations(loop)).toThrow(/define_goal.*CLAIM_WORK/)
  })

  it('rejects a name outside the vocabulary', () => {
    const signals = {
      ...SESSION_LOOP.states.work.signals,
      PUSH_WORK: { describe: 'Push a unit of work.' },
    } as unknown as SignalTable
    const loop = loopWith({ work: { ...SESSION_LOOP.states.work, signals } })

    expect(() => signalsModule.assertSignalDeclarations(loop)).toThrow(/PUSH_WORK/)
  })

  it('rejects a vocabulary name declared by no state', () => {
    const on = Object.fromEntries(
      Object.entries(SESSION_LOOP.states.define_goal.on)
        .filter(([key]) => key !== 'agent_sent_signal.SET_GOAL'),
    ) as unknown as LoopState['on']
    const loop = loopWith({
      define_goal: { ...SESSION_LOOP.states.define_goal, signals: {}, on },
    })

    expect(() => signalsModule.assertSignalDeclarations(loop)).toThrow(/SET_GOAL.*declared by no state/)
  })

  it('rejects an example that does not decode', () => {
    const schema = Schema.Struct({ goal: Schema.String })
      .annotate({ examples: [{ goal: 42 } as unknown as { goal: string }] })
    const loop = loopWith({
      define_goal: {
        ...SESSION_LOOP.states.define_goal,
        signals: { SET_GOAL: { describe: 'State the goal.', schema } },
      },
    })

    expect(() => signalsModule.assertSignalDeclarations(loop)).toThrow(/SET_GOAL.*example/)
  })

  it('rejects a reserved schema property', () => {
    const schema = Schema.Struct({ type: Schema.String })
    const loop = loopWith({
      define_goal: {
        ...SESSION_LOOP.states.define_goal,
        signals: { SET_GOAL: { describe: 'State the goal.', schema } },
      },
    })

    expect(() => signalsModule.assertSignalDeclarations(loop)).toThrow(/type/)
  })

  it('rejects a blank describe', () => {
    const loop = loopWith({
      define_goal: {
        ...SESSION_LOOP.states.define_goal,
        signals: {
          SET_GOAL: {
            describe: ' ',
            schema: schemaOf(SESSION_LOOP.states.define_goal.signals.SET_GOAL),
          },
        },
      },
    })

    expect(() => signalsModule.assertSignalDeclarations(loop)).toThrow(/SET_GOAL.*describe/)
  })
})

describe('renderSignals', () => {
  it('renders every declared signal by default', () => {
    const text = signalsModule.renderSignals(specsFor('validate'))

    expect(text).toContain('- GOAL_ACHIEVED —')
    expect(text).toContain('- GOAL_INCOMPLETE —')
  })

  it('renders a selected subset in the given order', () => {
    const text = signalsModule.renderSignals(specsFor('validate'), ['GOAL_INCOMPLETE', 'GOAL_ACHIEVED'])

    expect(text.indexOf('GOAL_INCOMPLETE')).toBeLessThan(text.indexOf('GOAL_ACHIEVED'))
  })

  it('omits an undeclared key', () => {
    expect(signalsModule.renderSignals(specsFor('define_goal'), ['CLAIM_WORK']))
      .toBe('Signals now: none')
  })

  it('renders none for an empty selection', () => {
    expect(signalsModule.renderSignals(specsFor('define_goal'), [])).toBe('Signals now: none')
  })

  it('renders a duplicate key once', () => {
    const text = signalsModule.renderSignals(specsFor('define_goal'), ['SET_GOAL', 'SET_GOAL'])

    expect(text.match(/SET_GOAL/g)).toHaveLength(1)
  })

  it('renders none for a state with no signals', () => {
    expect(signalsModule.renderSignals(specsFor('parked'))).toBe('Signals now: none')
  })
})
