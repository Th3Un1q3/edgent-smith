import { Schema } from 'effect'
import type { Issue } from 'effect/SchemaIssue'

/**
One signal a policy can enable: the instruction the agent reads and its payload shape.
*/
export interface SignalSpec {
  readonly describe: string
  /**
  Absent when the signal declares no payload fields.
  */
  readonly schema?: Schema.Codec<unknown, unknown, never, never>
}

/**
One machine's signal declarations: the manifest's prose plus the payload codecs
JSON cannot hold.
*/
export interface SignalSources {
  readonly signals: Readonly<Record<string, { readonly describe: string }>>
  readonly codecs: Readonly<Partial<Record<string, SignalSpec['schema']>>>
}

/**
One policy's signals by name. Names are not limited to the manifest: a policy
may enable an ad-hoc name, and the table it builds is the authority on what is
available.
*/
export type SignalTable = Readonly<Partial<Record<string, SignalSpec>>>

export type ToolSignal = string

export interface SchemaViolation {
  readonly path: string
  readonly expected: string
}

export type SignalRefusal
  = | {
    readonly code: 'unknown_signal'
    readonly signal: string
    readonly state: string
    readonly available_signals: readonly string[]
  }
  | {
    readonly code: 'unavailable_signal'
    readonly signal: string
    readonly state: string
    readonly available_signals: readonly string[]
  }
  | {
    readonly code: 'invalid_payload'
    readonly signal: string
    readonly state: string
    readonly schema_validation_error: readonly SchemaViolation[]
  }

export interface ValidatedSignal {
  readonly type: `agent_sent_signal.${string}`
  readonly payload?: unknown
}

export type SignalValidation
  = | { readonly ok: true, readonly event: ValidatedSignal }
    | { readonly ok: false, readonly refusal: SignalRefusal }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
A state value as one name: a leaf is itself, and a compound value becomes its dotted path.
*/
export const stateValuePath = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (value === null || typeof value !== 'object') return ''

  const [id, child] = Object.entries(value as Readonly<Record<string, unknown>>)[0] ?? []

  if (id === undefined) return ''

  const path = stateValuePath(child)

  return path === '' ? id : id + '.' + path
}

/**
The leaf name a person sees: `towards_goal.validate` reads as `validate`.
*/
export const stateLeaf = (value: unknown): string => {
  const path = stateValuePath(value)

  return path.slice(path.lastIndexOf('.') + 1)
}

const eventType = (signal: string): `agent_sent_signal.${string}` => `agent_sent_signal.${signal}`

const availableSignals = (signals: SignalTable): string[] =>
  Object.keys(signals).filter(name => signals[name] !== undefined)

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

export const renderSignals = (signals: SignalTable, signal_keys?: readonly string[]): string => {
  const declared = availableSignals(signals)
  const names = signal_keys === undefined
    ? declared
    : [...new Set(signal_keys)].filter(name => declared.includes(name))

  return names.length === 0
    ? 'Signals now: none'
    : 'Signals now:\n' + names.map(name => '- ' + name + ' — ' + (signals[name]?.describe ?? '')).join('\n')
}

const renderAvailable = (signals: SignalTable): string => renderSignals(signals, availableSignals(signals))

export const refusalMessage = (refusal: SignalRefusal, signals: SignalTable): string => {
  switch (refusal.code) {
    case 'unknown_signal': {
      const name = refusal.signal === '' ? 'the signal' : refusal.signal
      return 'Unknown signal: ' + name + '.\n' + renderAvailable(signals)
    }
    case 'unavailable_signal': {
      return refusal.signal + ' is not available in ' + stateLeaf(refusal.state) + '.\n' + renderAvailable(signals)
    }
    case 'invalid_payload': {
      const lines = refusal.schema_validation_error.map(violation => '- ' + violation.path + ': expected ' + violation.expected)
      const example = exampleOf(Object.hasOwn(signals, refusal.signal) ? signals[refusal.signal] : undefined)

      return refusal.signal + ' payload is invalid in ' + stateLeaf(refusal.state) + '.'
        + (lines.length === 0 ? '' : '\n' + lines.join('\n'))
        + (example === undefined ? '' : '\nExample: ' + example)
    }
  }
}

const fieldCodec = (definition: unknown): Schema.Codec<unknown, unknown, never, never> | undefined => {
  if (!isObject(definition)) return undefined

  const minLength = definition['minLength']

  switch (definition['type']) {
    case 'string': {
      return typeof minLength === 'number'
        ? Schema.Trim.check(Schema.isMinLength(minLength))
        : Schema.String
    }
    case 'number': {
      return Schema.Number
    }
    case 'boolean': {
      return Schema.Boolean
    }
    default: {
      return undefined
    }
  }
}

/**
Builds the payload codec a manifest signal declares. A codec cannot live in JSON,
so the manifest's JSON Schema is the source and this reads the object-of-fields
subset a signal declares. `undefined` means the signal validates no payload shape.
*/
export const manifestCodec = (declaration: unknown): SignalSpec['schema'] | undefined => {
  if (!isObject(declaration) || !isObject(declaration['schema'])) return undefined

  const schema = declaration['schema']

  if (schema['type'] !== 'object' || !isObject(schema['properties'])) return undefined

  const fields: Record<string, Schema.Codec<unknown, unknown, never, never>> = {}

  for (const [name, definition] of Object.entries(schema['properties'])) {
    const codec = fieldCodec(definition)

    if (codec === undefined) return undefined
    fields[name] = codec
  }

  if (Object.keys(fields).length === 0) return undefined

  const examples = schema['examples']

  return Schema.Struct(fields).annotate({
    examples: Array.isArray(examples) ? examples : [],
  }) as unknown as SignalSpec['schema']
}

/**
Validates one agent signal against the enabled signal table and the running
machine's registry.
The table is the policy's authority, so an enabled ad-hoc name is accepted;
a name the registry declares is refused as unavailable, and a name the
registry does not declare is refused as unknown.
*/
export const validateSignal = (input: unknown, state: unknown, signals: SignalTable, registry: SignalTable): SignalValidation => {
  const stateName = stateLeaf(state)

  if (!isObject(input) || typeof input.type !== 'string' || input.type.trim() === '') {
    return refuse({ code: 'unknown_signal', signal: '', state: stateName, available_signals: availableSignals(signals) })
  }

  const signal = input.type.trim()
  const spec = Object.hasOwn(signals, signal) ? signals[signal] : undefined

  if (spec === undefined) {
    // SignalRefusal discriminates on `code`, so the merged literal needs an assertion.
    return refuse({
      code: Object.hasOwn(registry, signal) ? 'unavailable_signal' : 'unknown_signal',
      signal,
      state: stateName,
      available_signals: availableSignals(signals),
    } as SignalRefusal)
  }

  const extra = Object.keys(input).find(key => key !== 'type' && key !== 'payload')

  if (extra !== undefined) {
    return refuse({
      code: 'invalid_payload',
      signal,
      state: stateName,
      schema_validation_error: [{ path: extra, expected: 'only type and payload' }],
    })
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
        state: stateName,
        schema_validation_error: issuesOf(result.failure.issue),
      })
    : { ok: true, event: { type: eventType(signal), payload: result.success } }
}
