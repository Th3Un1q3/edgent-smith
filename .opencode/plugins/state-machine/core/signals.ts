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

const isNonNullObject = (value: unknown): value is object => typeof value === 'object' && value !== null

const stateEntryOf = (value: unknown): readonly [string | undefined, unknown] =>
  isNonNullObject(value)
    ? Object.entries(value)[0] ?? [undefined, undefined]
    : [undefined, undefined]

/**
A state value as one name: a leaf is itself, and a compound value becomes its dotted path.
*/
export const stateValuePath = (value: unknown): string =>
  typeof value === 'string' ? value : joinStatePath(...stateEntryOf(value))

const joinStatePath = (id: string | undefined, child: unknown): string => {
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

const TAG_WORDS: Readonly<Record<string, string>> = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Objects: 'an object',
  Arrays: 'an array',
}

const expectedOf = (ast: { readonly _tag: string }): string =>
  Object.hasOwn(TAG_WORDS, ast._tag) ? TAG_WORDS[ast._tag] : 'the declared type'

const pathOf = (path: readonly PropertyKey[]): string => ['payload', ...path.map(String)].join('.')

const filterExpectation = (issue: Extract<Issue, { readonly _tag: 'Filter' }>): string =>
  issue.filter.annotations?.expected ?? 'a valid value'

const STRUCTURAL_EXPECTATIONS: Readonly<Record<string, string>> = {
  UnexpectedKey: 'no excess property',
  MissingKey: 'required',
}

const structuralExpectation = (issue: Issue): string | undefined =>
  issue._tag === 'InvalidType' ? expectedOf(issue.ast) : STRUCTURAL_EXPECTATIONS[issue._tag]

const leafExpectation = (issue: Issue): string => {
  return issue._tag === 'Filter' ? filterExpectation(issue) : structuralExpectation(issue) ?? 'a valid value'
}

const leafViolation = (issue: Issue, path: readonly PropertyKey[]): SchemaViolation =>
  ({ path: pathOf(path), expected: leafExpectation(issue) })

type NestedIssue = Extract<Issue, { readonly _tag: 'Pointer' | 'Encoding' }>

const isNestedIssue = (issue: Issue): issue is NestedIssue =>
  issue._tag === 'Pointer' || issue._tag === 'Encoding'

const nestedPathOf = (issue: NestedIssue): readonly PropertyKey[] => issue._tag === 'Pointer' ? issue.path : []

const issuesOf = (issue: Issue, path: readonly PropertyKey[]): readonly SchemaViolation[] => {
  if (issue._tag === 'Composite') return issue.issues.flatMap(child => issuesOf(child, path))
  return isNestedIssue(issue) ? issuesOf(issue.issue, [...path, ...nestedPathOf(issue)]) : [leafViolation(issue, path)]
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

const asList = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : []

const annotationsOf = (spec: SignalSpec | undefined): Record<string, unknown> | undefined =>
  spec?.schema?.ast.annotations as Record<string, unknown> | undefined

const examplesOf = (spec: SignalSpec | undefined): readonly unknown[] =>
  asList(annotationsOf(spec)?.['examples'])

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

const invalidPayloadMessage = (
  refusal: Extract<SignalRefusal, { readonly code: 'invalid_payload' }>,
  signals: SignalTable,
): string => {
  const lines = refusal.schema_validation_error.map(violation => '- ' + violation.path + ': expected ' + violation.expected)
  const example = exampleOf(signalSpecOf(signals, refusal.signal))

  return refusal.signal + ' payload is invalid in ' + stateLeaf(refusal.state) + '.'
    + (lines.length === 0 ? '' : '\n' + lines.join('\n'))
    + (example === undefined ? '' : '\nExample: ' + example)
}

const unknownSignalMessage = (signal: string): string =>
  signal === '' ? 'Unknown signal: the signal' : 'Unknown signal: ' + signal

export const refusalMessage = (refusal: SignalRefusal, signals: SignalTable): string => {
  if (refusal.code === 'invalid_payload') return invalidPayloadMessage(refusal, signals)

  const available = renderAvailable(signals)

  const problem = refusal.code === 'unknown_signal'
    ? unknownSignalMessage(refusal.signal)
    : refusal.signal + ' is not available in ' + stateLeaf(refusal.state)

  return problem + '.\n' + available
}

const FIELD_CODECS = new Map<unknown, Schema.Codec<unknown, unknown, never, never>>([
  ['number', Schema.Number],
  ['boolean', Schema.Boolean],
])

const stringCodec = (definition: Record<string, unknown>): Schema.Codec<unknown, unknown, never, never> => {
  const minLength = definition['minLength']

  return typeof minLength === 'number'
    ? Schema.Trim.check(Schema.isMinLength(minLength))
    : Schema.String
}

const fieldCodec = (definition: unknown): Schema.Codec<unknown, unknown, never, never> | undefined => {
  if (!isObject(definition)) return undefined

  return definition['type'] === 'string' ? stringCodec(definition) : FIELD_CODECS.get(definition['type'])
}

interface ObjectSchemaFields {
  readonly schema: Record<string, unknown>
  readonly properties: Record<string, unknown>
}

const isObjectSchema = (value: unknown): value is Record<string, unknown> =>
  isObject(value) && value['type'] === 'object'

const objectSchemaOf = (declaration: unknown): Record<string, unknown> | undefined => {
  if (!isObject(declaration)) return undefined

  const schema = declaration['schema']

  return isObjectSchema(schema) ? schema : undefined
}

const objectSchemaFields = (declaration: unknown): ObjectSchemaFields | undefined => {
  const schema = objectSchemaOf(declaration)

  if (schema === undefined) return undefined

  const properties = schema['properties']

  return isObject(properties) ? { schema, properties } : undefined
}

const readFieldCodecs = (
  properties: Record<string, unknown>,
): Record<string, Schema.Codec<unknown, unknown, never, never>> | undefined => {
  const codecs = Object.fromEntries(
    Object.entries(properties).map(([name, definition]) => [name, fieldCodec(definition)] as const),
  )

  return Object.keys(codecs).length === 0 || Object.values(codecs).includes(undefined)
    ? undefined
    : codecs as Record<string, Schema.Codec<unknown, unknown, never, never>>
}

/**
Builds the payload codec a manifest signal declares. A codec cannot live in JSON,
so the manifest's JSON Schema is the source and this reads the object-of-fields
subset a signal declares. `undefined` means the signal validates no payload shape.
*/
export const manifestCodec = (declaration: unknown): SignalSpec['schema'] | undefined => {
  const declared = objectSchemaFields(declaration)

  if (declared === undefined) return undefined

  const fields = readFieldCodecs(declared.properties)

  if (fields === undefined) return undefined

  const examples = declared.schema['examples']

  return Schema.Struct(fields).annotate({
    examples: asList(examples).filter(isObject),
  })
}

/**
Validates one agent signal against the enabled signal table and the running
machine's registry.
The table is the policy's authority, so an enabled ad-hoc name is accepted;
a name the registry declares is refused as unavailable, and a name the
registry does not declare is refused as unknown.
*/
const signalNameOf = (input: Record<string, unknown>): string | undefined => {
  const type = input['type']

  if (typeof type !== 'string') return undefined

  const name = type.trim()

  return name === '' ? undefined : name
}

const signalSpecOf = (signals: SignalTable, signal: string): SignalSpec | undefined =>
  Object.hasOwn(signals, signal) ? signals[signal] : undefined

const excessKeyOf = (input: Record<string, unknown>): string | undefined =>
  Object.keys(input).find(key => key !== 'type' && key !== 'payload')

const unavailableRefusal = (signal: string, state: string, available_signals: readonly string[]): SignalRefusal =>
  ({ code: 'unavailable_signal', signal, state, available_signals })

const unknownRefusal = (signal: string, state: string, available_signals: readonly string[]): SignalRefusal =>
  ({ code: 'unknown_signal', signal, state, available_signals })

const refusalOf = (
  registry: SignalTable,
  signal: string,
  state: string,
  available_signals: readonly string[],
): SignalRefusal => {
  const build = Object.hasOwn(registry, signal) ? unavailableRefusal : unknownRefusal

  return build(signal, state, available_signals)
}

const decodePayload = (
  fields: Record<string, unknown>,
  schema: NonNullable<SignalSpec['schema']>,
  signal: string,
  state: string,
): SignalValidation => {
  const result = Schema.decodeUnknownResult(schema)(fields.payload, {
    errors: 'all',
    onExcessProperty: 'error',
  })

  return result._tag === 'Failure'
    ? refuse({
        code: 'invalid_payload',
        signal,
        state,
        schema_validation_error: issuesOf(result.failure.issue, []),
      })
    : { ok: true, event: { type: eventType(signal), payload: result.success } }
}

const decodeSignalPayload = (
  fields: Record<string, unknown>,
  schema: SignalSpec['schema'],
  signal: string,
  state: string,
): SignalValidation => {
  const extra = excessKeyOf(fields)

  if (extra !== undefined) {
    return refuse({
      code: 'invalid_payload',
      signal,
      state,
      schema_validation_error: [{ path: extra, expected: 'only type and payload' }],
    })
  }

  return schema === undefined
    ? { ok: true, event: { type: eventType(signal) } }
    : decodePayload(fields, schema, signal, state)
}

const recordOf = (value: unknown): Record<string, unknown> => isObject(value) ? value : {}

export const validateSignal = (input: unknown, state: unknown, signals: SignalTable, registry: SignalTable): SignalValidation => {
  const stateName = stateLeaf(state)

  const fields = recordOf(input)

  const signal = signalNameOf(fields)

  if (signal === undefined) {
    return refuse({ code: 'unknown_signal', signal: '', state: stateName, available_signals: availableSignals(signals) })
  }

  const spec = signalSpecOf(signals, signal)

  return spec === undefined
    ? refuse(refusalOf(registry, signal, stateName, availableSignals(signals)))
    : decodeSignalPayload(fields, spec.schema, signal, stateName)
}
