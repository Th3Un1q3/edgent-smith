import { Schema } from 'effect'
import type { Issue } from 'effect/SchemaIssue'

import type { LoopDefinition, LoopStateId } from './machine'

/**
The five signals the model may send. Each maps to `agent_sent_signal.<SIGNAL>`.
*/
export const TOOL_SIGNALS = ['SET_GOAL', 'CLAIM_WORK', 'GOAL_ACHIEVED', 'GOAL_INCOMPLETE', 'LESSON'] as const
export type ToolSignal = (typeof TOOL_SIGNALS)[number]

/**
One signal a state accepts: the instruction the agent reads and its payload shape.
*/
export interface SignalSpec {
  readonly describe: string
  /**
  Absent when the signal declares no payload fields.
  */
  readonly schema?: Schema.Codec<unknown, unknown, never, never>
}

export type SignalTable = Readonly<Partial<Record<ToolSignal, SignalSpec>>>

export interface SchemaViolation {
  readonly path: string
  readonly expected: string
}

export type SignalRefusal
  = | { readonly code: 'unknown_signal', readonly signal: string, readonly state: LoopStateId, readonly available_signals: readonly ToolSignal[] }
    | { readonly code: 'unavailable_signal', readonly signal: ToolSignal, readonly state: LoopStateId, readonly available_signals: readonly ToolSignal[] }
    | {
      readonly code: 'invalid_payload'
      readonly signal: ToolSignal
      readonly state: LoopStateId
      readonly available_signals: readonly ToolSignal[]
      readonly schema_validation_error: readonly SchemaViolation[]
    }

export interface ValidatedSignal {
  readonly type: `agent_sent_signal.${ToolSignal}`
  readonly payload?: unknown
}

export type SignalValidation
  = | { readonly ok: true, readonly event: ValidatedSignal }
    | { readonly ok: false, readonly refusal: SignalRefusal }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isToolSignal = (value: string): value is ToolSignal =>
  (TOOL_SIGNALS as readonly string[]).includes(value)

const eventType = (signal: ToolSignal): `agent_sent_signal.${ToolSignal}` => `agent_sent_signal.${signal}`

const availableSignals = (signals: SignalTable): ToolSignal[] =>
  Object.keys(signals).filter(isToolSignal)

const refuse = (refusal: SignalRefusal): SignalValidation => ({ ok: false, refusal })

const expectedOf = (ast: { readonly _tag: string }): string => {
  switch (ast._tag) {
    case 'String': {
      return 'string'
    }
    case 'Number': {
      return 'number'
    }
    case 'Boolean': {
      return 'boolean'
    }
    case 'Objects': {
      return 'an object'
    }
    case 'Arrays': {
      return 'an array'
    }
    default: {
      return 'the declared type'
    }
  }
}

const pathOf = (path: readonly PropertyKey[]): string => ['payload', ...path.map(String)].join('.')

const issuesOf = (issue: Issue, path: readonly PropertyKey[] = []): readonly SchemaViolation[] => {
  switch (issue._tag) {
    case 'Composite': {
      return issue.issues.flatMap(child => issuesOf(child, path))
    }
    case 'Pointer': {
      return issuesOf(issue.issue, [...path, ...issue.path])
    }
    case 'Encoding': {
      return issuesOf(issue.issue, path)
    }
    case 'Filter': {
      return [{ path: pathOf(path), expected: issue.filter.annotations?.expected ?? 'a valid value' }]
    }
    case 'UnexpectedKey': {
      return [{ path: pathOf(path), expected: 'no excess property' }]
    }
    case 'MissingKey': {
      return [{ path: pathOf(path), expected: 'required' }]
    }
    case 'InvalidType': {
      return [{ path: pathOf(path), expected: expectedOf(issue.ast) }]
    }
    default: {
      return [{ path: pathOf(path), expected: 'a valid value' }]
    }
  }
}

const exampleOf = (spec: SignalSpec | undefined): string | undefined => {
  const [example] = examplesOf(spec)

  if (example === undefined) return undefined

  try {
    return JSON.stringify(example)
  }
  catch {
    return undefined
  }
}

const examplesOf = (spec: SignalSpec | undefined): readonly unknown[] => {
  const annotations = spec?.schema?.ast.annotations as Record<string, unknown> | undefined
  const examples = annotations?.['examples']

  return Array.isArray(examples) ? examples : []
}

const reservedProperties = (schema: SignalSpec['schema']): readonly string[] => {
  const ast = schema?.ast

  return ast === undefined || ast._tag !== 'Objects'
    ? []
    : ast.propertySignatures
        .map(property => String(property.name))
        .filter(name => name === 'type' || name === 'payload')
}

const ARM_PREFIX = 'agent_sent_signal.'

const armSignals = (on: Readonly<Record<string, unknown>>): readonly string[] =>
  Object.keys(on)
    .filter(key => key.startsWith(ARM_PREFIX))
    .map(key => key.slice(ARM_PREFIX.length))

export const renderSignals = (signals: SignalTable, signal_keys?: readonly ToolSignal[]): string => {
  const declared = availableSignals(signals)
  const names = signal_keys === undefined
    ? declared
    : [...new Set(signal_keys)].filter(name => declared.includes(name))

  return names.length === 0
    ? 'Signals now: none'
    : 'Signals now:\n' + names.map(name => '- ' + name + ' — ' + (signals[name]?.describe ?? '')).join('\n')
}

export const refusalMessage = (refusal: SignalRefusal, signals: SignalTable): string => {
  switch (refusal.code) {
    case 'unknown_signal': {
      const name = refusal.signal === '' ? 'the signal' : refusal.signal
      return 'Unknown signal: ' + name + '.\nSignals: ' + TOOL_SIGNALS.join(', ') + '.'
    }
    case 'unavailable_signal': {
      return refusal.signal + ' is not available in ' + refusal.state + '.\n' + renderSignals(signals)
    }
    case 'invalid_payload': {
      const lines = refusal.schema_validation_error.map(violation => '- ' + violation.path + ': expected ' + violation.expected)
      const example = exampleOf(signals[refusal.signal])

      return refusal.signal + ' payload is invalid in ' + refusal.state + '.'
        + (lines.length === 0 ? '' : '\n' + lines.join('\n'))
        + (example === undefined ? '' : '\nExample: ' + example)
    }
  }
}

/**
Validates one agent signal against the declarations of the state it arrives in.
The order is shape, vocabulary, declaration, payload; the first failure wins.
*/
export const validateSignal = (input: unknown, state: LoopStateId, signals: SignalTable): SignalValidation => {
  const available_signals = availableSignals(signals)

  if (!isObject(input) || typeof input.type !== 'string' || input.type.trim() === '') {
    return refuse({ code: 'unknown_signal', signal: '', state, available_signals })
  }

  const signal = input.type.trim()

  if (!isToolSignal(signal)) {
    return refuse({ code: 'unknown_signal', signal, state, available_signals })
  }

  const extra = Object.keys(input).find(key => key !== 'type' && key !== 'payload')

  if (extra !== undefined) {
    return refuse({
      code: 'invalid_payload',
      signal,
      state,
      available_signals,
      schema_validation_error: [{ path: extra, expected: 'only type and payload' }],
    })
  }

  const spec = signals[signal]

  if (spec === undefined) {
    return refuse({ code: 'unavailable_signal', signal, state, available_signals })
  }

  if (spec.schema === undefined) {
    return { ok: true, event: { type: eventType(signal) } }
  }

  const result = Schema.decodeUnknownResult(spec.schema)(input.payload, {
    errors: 'all',
    onExcessProperty: 'error',
  })

  return result._tag === 'Failure'
    ? refuse({
        code: 'invalid_payload',
        signal,
        state,
        available_signals,
        schema_validation_error: issuesOf(result.failure.issue),
      })
    : { ok: true, event: { type: eventType(signal), payload: result.success } }
}

const assertSignalSpec = (state: string, name: string, spec: SignalSpec | undefined): void => {
  if (spec === undefined) return

  if (spec.describe.trim() === '') {
    throw new Error(state + '.' + name + ' has a blank describe')
  }

  const reserved = reservedProperties(spec.schema)

  if (reserved.length > 0) {
    throw new Error(state + '.' + name + ' declares the reserved property ' + reserved.join(', '))
  }

  const [example] = examplesOf(spec)

  if (example === undefined || spec.schema === undefined) return

  const result = Schema.decodeUnknownResult(spec.schema)(example, { onExcessProperty: 'error' })

  if (result._tag === 'Failure') {
    throw new Error(state + '.' + name + ' example does not decode')
  }
}

/**
Verifies that every state's declarations match its transition arms, that the
vocabulary is fully declared, and that every declared example decodes. Throws on
the first violation; a mismatch fails the plugin load instead of advertising a
signal the machine cannot handle.
*/
export const assertSignalDeclarations = (loop: LoopDefinition): void => {
  const declared = new Set<string>()

  for (const [state, definition] of Object.entries(loop.states)) {
    const signals = definition.signals
    const declaredHere = Object.keys(signals)

    for (const name of declaredHere) {
      if (!isToolSignal(name)) {
        throw new Error(state + ' declares ' + name + ', which is not a signal in TOOL_SIGNALS')
      }

      declared.add(name)
      assertSignalSpec(state, name, signals[name])
    }

    const arms = armSignals(definition.on as unknown as Readonly<Record<string, unknown>>)

    for (const name of arms) {
      if (!declaredHere.includes(name)) {
        throw new Error(state + ' has an arm for ' + name + ' but no declaration')
      }
    }

    for (const name of declaredHere) {
      if (!arms.includes(name)) {
        throw new Error(state + ' declares ' + name + ' but has no arm')
      }
    }
  }

  for (const name of TOOL_SIGNALS) {
    if (!declared.has(name)) {
      throw new Error(name + ' is declared by no state')
    }
  }
}
