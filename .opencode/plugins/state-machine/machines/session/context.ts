/**
 * The session machine's own context: what a session remembers between turns.
 * The core treats it as an opaque record, so only this module reads its fields.
 */
import type { SignalsPolicy } from '../../core/machine'
import type { ToolPolicyRule } from '../../core/snapshot'

export type IntentKind = 'none' | 'improvement' | 'lesson'

export interface InjectedMemories {
  readonly full: readonly string[]
  readonly index: readonly string[]
}

export interface CallbackPayload {
  readonly ok: boolean
  readonly exitCode?: number
  readonly output?: string
  readonly value?: InjectedMemories
}

export interface Failure {
  readonly reason: string
  readonly detail?: string
}

/**
Incomplete goals allowed before the loop escalates to `panic`.
*/
export const MAX_ATTEMPTS = 3

/**
Lessons kept in `memories`; the oldest drop first.
*/
export const MEMORY_LIMIT = 20

export type LoopContext = {
  readonly sessionId: string
  readonly agent: string
  readonly parentID?: string | undefined
  readonly maxAttempts: number
  readonly memoryLimit: number
  goal: string
  intent: IntentKind
  attempts: number
  nudges: number
  memories: string[]
  improvements: string[]
  injectedSkills: string[]
  memoryTokens?: string[]
  injected: Record<string, InjectedMemories>
  results: Record<string, CallbackPayload>
  policy?: ToolPolicyRule
  signalsPolicy?: SignalsPolicy
  failure?: Failure
}

/**
The session context as a snapshot carries it: the context without the fields
that are rebuilt per session.
*/
export type StoredSession = Omit<LoopContext, 'agent' | 'maxAttempts' | 'memoryLimit' | 'parentID'>

export interface ContextDefaults {
  readonly sessionId: string
  readonly agent: string
  readonly parentID?: string | undefined
  readonly maxAttempts?: number | undefined
  readonly memoryLimit?: number | undefined
}

const limitsOf = (defaults: ContextDefaults): Pick<LoopContext, 'maxAttempts' | 'memoryLimit'> => ({
  maxAttempts: defaults.maxAttempts ?? MAX_ATTEMPTS,
  memoryLimit: defaults.memoryLimit ?? MEMORY_LIMIT,
})

export const freshContext = (defaults: ContextDefaults): LoopContext => ({
  sessionId: defaults.sessionId,
  agent: defaults.agent,
  ...(defaults.parentID !== undefined && { parentID: defaults.parentID }),
  ...limitsOf(defaults),
  goal: '',
  intent: 'none',
  attempts: 0,
  nudges: 0,
  memories: [],
  improvements: [],
  injectedSkills: [],
  memoryTokens: [],
  injected: {},
  results: {},
})

const restoreScalars = (previous: Partial<LoopContext>): Partial<LoopContext> => ({
  ...(typeof previous.goal === 'string' && { goal: previous.goal }),
  ...(isIntentKind(previous.intent) && { intent: previous.intent }),
  ...counters(previous),
})

const restoreLists = (previous: Partial<LoopContext>): Partial<LoopContext> => copyLists(previous)

const restoreRecords = (previous: Partial<LoopContext>): Partial<LoopContext> => ({
  injected: readInjected(previous.injected) ?? {},
  results: readResults(previous.results),
})

const restoreOptionals = (previous: Partial<LoopContext>): Record<string, unknown> =>
  Object.fromEntries(OPTIONAL_FIELDS.flatMap((key): [string, unknown][] => {
    const stored = previous[key]
    return stored === undefined ? [] : [[key, stored]]
  }))

/**
The stored context spread over a fresh one, so a field the snapshot predates, or
one the reader could not validate, keeps its default.
*/
export const restoreContext = (
  stored: Readonly<Record<string, unknown>>,
  defaults: ContextDefaults,
): LoopContext => {
  const previous = stored as Partial<LoopContext>

  return Object.assign(
    freshContext(defaults),
    restoreScalars(previous),
    restoreLists(previous),
    restoreRecords(previous),
    restoreOptionals(previous),
  )
}

/**
The callback names this machine answers. Core treats them as opaque strings.
*/
export const CALLBACK_NAMES = ['quality_check_ready', 'skill_ready', 'memories_ready', 'subagent_ready'] as const

/**
Characters kept for one snapshot text field; a longer result is cut, not rejected.
*/
export const SNAPSHOT_TEXT_LIMIT = 1024

const truncate = (text: string, limit: number): string => text.length <= limit ? text : text.slice(0, limit)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

const COUNTER_FIELDS = ['attempts', 'nudges'] as const
const LIST_FIELDS = ['memories', 'improvements', 'injectedSkills', 'memoryTokens'] as const
const OPTIONAL_FIELDS = ['policy', 'signalsPolicy', 'failure'] as const

type CounterFields = { attempts?: number, nudges?: number }
type ListFields = { memories?: string[], improvements?: string[], injectedSkills?: string[], memoryTokens?: string[] }

const counters = (source: Readonly<Record<string, unknown>>): CounterFields =>
  Object.fromEntries(COUNTER_FIELDS.flatMap((key): [string, number][] => {
    const count = source[key]

    return typeof count === 'number' ? [[key, count]] : []
  }))

const copyLists = (source: Readonly<Record<string, unknown>>): ListFields =>
  Object.fromEntries(LIST_FIELDS.flatMap((key): [string, string[]][] => {
    const list = source[key]

    return isStringArray(list) ? [[key, [...list]]] : []
  }))

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const INTENT_KINDS: readonly IntentKind[] = ['none', 'improvement', 'lesson']

const isIntentKind = (value: unknown): value is IntentKind =>
  typeof value === 'string' && (INTENT_KINDS as readonly string[]).includes(value)

const isInjectedMemories = (value: unknown): value is InjectedMemories =>
  isPlainObject(value) && isStringArray(value.full) && isStringArray(value.index)

const isDeclaredState = (states: ReadonlySet<string>, stateId: string): boolean =>
  states.has(stateId) || [...states].some(path => path.endsWith('.' + stateId))

const POLICY_FIELD_CHECKS: Readonly<Record<string, (value: unknown) => boolean>> = {
  errorMessage: value => typeof value === 'string',
  allowedTools: isStringArray,
}

const hasPolicyStateId = (value: unknown): value is Record<string, unknown> & { stateId: string } =>
  isPlainObject(value) && typeof value.stateId === 'string'

const isPolicy = (value: unknown, states: ReadonlySet<string>): value is ToolPolicyRule => {
  if (!hasPolicyStateId(value)) return false

  const stateId = value.stateId

  return isDeclaredState(states, stateId)
    && Object.entries(POLICY_FIELD_CHECKS).every(([field, allowed]) => allowed(value[field]))
}

const isSignalsPolicy = (value: unknown): value is SignalsPolicy =>
  isPlainObject(value) && isStringArray(value.names)

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string'

const isFailure = (value: unknown): value is Failure =>
  isPlainObject(value)
  && typeof value.reason === 'string'
  && isOptionalString(value.detail)

const OPTIONAL_PAYLOAD_CHECKS: Readonly<Record<string, (value: unknown) => boolean>> = {
  exitCode: value => value === undefined || typeof value === 'number',
  output: value => value === undefined || typeof value === 'string',
  value: value => value === undefined || isInjectedMemories(value),
}

const hasOptionalPayloadFields = (value: Record<string, unknown>): boolean =>
  Object.entries(OPTIONAL_PAYLOAD_CHECKS).every(([key, isAllowed]) => isAllowed(value[key]))

const isCallbackPayload = (value: unknown): value is CallbackPayload =>
  isPlainObject(value)
  && typeof value.ok === 'boolean'
  && hasOptionalPayloadFields(value)

/**
A map with one malformed entry is salvageable: the bad entry is dropped, so a
single truncated callback does not restart the session.
*/
const readResults = (value: unknown): Record<string, CallbackPayload> => {
  return isPlainObject(value)
    ? (Object.fromEntries(
        Object.entries(value).filter(([, item]) => isCallbackPayload(item)),
      ) as Record<string, CallbackPayload>)
    : {}
}

const readInjected = (value: unknown): Record<string, InjectedMemories> | undefined => {
  if (!isPlainObject(value)) return {}

  const entries = Object.entries(value)

  return entries.every(([, item]) => isInjectedMemories(item))
    ? entries.reduce<Record<string, InjectedMemories>>((all, [key, item]) => {
        all[key] = item as InjectedMemories
        return all
      }, {})
    : undefined
}

const readScalars = (value: Readonly<Record<string, unknown>>): Record<string, unknown> => ({
  ...(typeof value.goal === 'string' && { goal: truncate(value.goal, SNAPSHOT_TEXT_LIMIT) }),
  ...(isIntentKind(value.intent) && { intent: value.intent }),
  ...counters(value),
})

const readLists = (value: Readonly<Record<string, unknown>>): Record<string, unknown> => copyLists(value)

const readRecords = (value: Readonly<Record<string, unknown>>): Record<string, unknown> => ({
  injected: readInjected(value.injected) ?? {},
  results: readResults(value.results),
})

const isStorablePolicy = (value: unknown, states: ReadonlySet<string>): value is ToolPolicyRule =>
  value !== undefined && isPolicy(value, states)

const isStorableSignalsPolicy = (value: unknown): value is SignalsPolicy =>
  value !== undefined && isSignalsPolicy(value)

const isStorableFailure = (value: unknown): value is Failure =>
  value !== undefined && isFailure(value)

const OPTIONAL_CHECKS: Readonly<Record<string, (value: unknown, states: ReadonlySet<string>) => boolean>> = {
  policy: (value, states) => isStorablePolicy(value, states),
  signalsPolicy: isStorableSignalsPolicy,
  failure: isStorableFailure,
}

const readOptionals = (
  value: Readonly<Record<string, unknown>>,
  states: ReadonlySet<string>,
): Record<string, unknown> =>
  Object.fromEntries(OPTIONAL_FIELDS.flatMap((key): [string, unknown][] =>
    OPTIONAL_CHECKS[key](value[key], states) ? [[key, value[key]]] : []))

/**
The context reader: every field it can validate survives, a field it cannot is
left to the fresh default, and only a record without a usable session id is
refused whole.
*/
const readStored = (
  value: Readonly<Record<string, unknown>>,
  states: ReadonlySet<string>,
): Record<string, unknown> | undefined => {
  return typeof value.sessionId !== 'string' || value.sessionId === ''
    ? undefined
    : {
        sessionId: value.sessionId,
        ...readScalars(value),
        ...readLists(value),
        ...readRecords(value),
        ...readOptionals(value, states),
      }
}

type SnapshotField
  = | 'sessionId'
    | 'goal'
    | 'intent'
    | 'attempts'
    | 'nudges'
    | 'memories'
    | 'improvements'
    | 'injectedSkills'
    | 'memoryTokens'
    | 'injected'
    | 'results'
    | 'policy'
    | 'signalsPolicy'
    | 'failure'

/**
The context fields a snapshot may carry, in write order. Every other key on the
input, including a credential accidentally added to the context, is dropped.
*/
const COPIERS: Readonly<Record<SnapshotField, (snapshot: Partial<StoredSession>) => unknown>> = {
  sessionId: snapshot => snapshot.sessionId,
  goal: snapshot => truncate(snapshot.goal ?? '', SNAPSHOT_TEXT_LIMIT),
  intent: snapshot => snapshot.intent,
  attempts: snapshot => snapshot.attempts,
  nudges: snapshot => snapshot.nudges,
  memories: snapshot => [...(snapshot.memories ?? [])],
  improvements: snapshot => [...(snapshot.improvements ?? [])],
  injectedSkills: snapshot => [...(snapshot.injectedSkills ?? [])],
  memoryTokens: snapshot => [...(snapshot.memoryTokens ?? [])],
  injected: snapshot => Object.fromEntries(
    Object.entries(snapshot.injected ?? {}).map(([key, item]) => [key, { full: [...item.full], index: [...item.index] }]),
  ),
  results: snapshot => Object.fromEntries(
    Object.entries(snapshot.results ?? {}).map(([key, item]) => [key, { ...item }]),
  ),
  policy: snapshot => snapshot.policy,
  signalsPolicy: snapshot => snapshot.signalsPolicy === undefined
    ? undefined
    : { names: [...snapshot.signalsPolicy.names] },
  failure: snapshot => snapshot.failure === undefined
    ? undefined
    : {
        reason: truncate(snapshot.failure.reason, SNAPSHOT_TEXT_LIMIT),
        ...(snapshot.failure.detail !== undefined && { detail: truncate(snapshot.failure.detail, SNAPSHOT_TEXT_LIMIT) }),
      },
}

export const SNAPSHOT_FIELDS = Object.keys(COPIERS) as readonly SnapshotField[]

export const snapshotCodec = {
  limit: SNAPSHOT_TEXT_LIMIT,
  fields: SNAPSHOT_FIELDS,
  bound: (snapshot: Readonly<Record<string, unknown>>): Record<string, unknown> => {
    const source = snapshot as Partial<StoredSession>

    return Object.fromEntries(SNAPSHOT_FIELDS.map(field => [field, COPIERS[field](source)]))
  },
  read: readStored,
}
