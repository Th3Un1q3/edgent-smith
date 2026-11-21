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
  memories: string[]
  improvements: string[]
  injectedSkills: string[]
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

export const freshContext = (defaults: ContextDefaults): LoopContext => ({
  sessionId: defaults.sessionId,
  agent: defaults.agent,
  ...(defaults.parentID !== undefined && { parentID: defaults.parentID }),
  maxAttempts: defaults.maxAttempts ?? MAX_ATTEMPTS,
  memoryLimit: defaults.memoryLimit ?? MEMORY_LIMIT,
  goal: '',
  intent: 'none',
  attempts: 0,
  memories: [],
  improvements: [],
  injectedSkills: [],
  injected: {},
  results: {},
})

/**
The stored context spread over a fresh one, so a field the snapshot predates, or
one the reader could not validate, keeps its default.
*/
export const restoreContext = (
  stored: Readonly<Record<string, unknown>>,
  defaults: ContextDefaults,
): LoopContext => {
  const previous = stored as Partial<LoopContext>

  return {
    ...freshContext(defaults),
    ...(typeof previous.goal === 'string' && { goal: previous.goal }),
    ...(isIntentKind(previous.intent) && { intent: previous.intent }),
    ...(typeof previous.attempts === 'number' && { attempts: previous.attempts }),
    ...(isStringArray(previous.memories) && { memories: [...previous.memories] }),
    ...(isStringArray(previous.improvements) && { improvements: [...previous.improvements] }),
    ...(isStringArray(previous.injectedSkills) && { injectedSkills: [...previous.injectedSkills] }),
    ...(isPlainObject(previous.injected) && { injected: readInjected(previous.injected) ?? {} }),
    ...(isPlainObject(previous.results) && { results: readResults(previous.results) }),
    ...(previous.policy !== undefined && { policy: previous.policy }),
    ...(previous.signalsPolicy !== undefined && { signalsPolicy: previous.signalsPolicy }),
    ...(previous.failure !== undefined && { failure: previous.failure }),
  }
}

/**
The callback names this machine answers. Core treats them as opaque strings.
*/
export const CALLBACK_NAMES = ['quality_check_ready', 'skill_ready', 'memories_ready'] as const

/**
Characters kept for one snapshot text field; a longer result is cut, not rejected.
*/
export const SNAPSHOT_TEXT_LIMIT = 1024

const truncate = (text: string, limit: number): string => text.length <= limit ? text : text.slice(0, limit)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const INTENT_KINDS: readonly IntentKind[] = ['none', 'improvement', 'lesson']

const isIntentKind = (value: unknown): value is IntentKind =>
  typeof value === 'string' && (INTENT_KINDS as readonly string[]).includes(value)

const isInjectedMemories = (value: unknown): value is InjectedMemories =>
  isPlainObject(value) && isStringArray(value.full) && isStringArray(value.index)

const isPolicy = (value: unknown, states: ReadonlySet<string>): value is ToolPolicyRule => {
  if (!isPlainObject(value) || typeof value.stateId !== 'string') return false

  const stateId = value.stateId

  return (states.has(stateId) || [...states].some(path => path.endsWith('.' + stateId)))
    && typeof value.errorMessage === 'string'
    && isStringArray(value.allowedTools)
}

const isSignalsPolicy = (value: unknown): value is SignalsPolicy =>
  isPlainObject(value) && isStringArray(value.names)

const isFailure = (value: unknown): value is Failure =>
  isPlainObject(value)
  && typeof value.reason === 'string'
  && (value.detail === undefined || typeof value.detail === 'string')

const isCallbackPayload = (value: unknown): value is CallbackPayload =>
  isPlainObject(value)
  && typeof value.ok === 'boolean'
  && (value.exitCode === undefined || typeof value.exitCode === 'number')
  && (value.output === undefined || typeof value.output === 'string')
  && (value.value === undefined || isInjectedMemories(value.value))

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

/**
The context reader: every field it can validate survives, a field it cannot is
left to the fresh default, and only a record without a usable session id is
refused whole.
*/
const readStored = (
  value: Readonly<Record<string, unknown>>,
  states: ReadonlySet<string>,
): Record<string, unknown> | undefined => {
  if (typeof value.sessionId !== 'string' || value.sessionId === '') return undefined

  const stored: Record<string, unknown> = {
    sessionId: value.sessionId,
    ...(typeof value.goal === 'string' && { goal: truncate(value.goal, SNAPSHOT_TEXT_LIMIT) }),
    ...(isIntentKind(value.intent) && { intent: value.intent }),
    ...(typeof value.attempts === 'number' && { attempts: value.attempts }),
    ...(isStringArray(value.memories) && { memories: [...value.memories] }),
    ...(isStringArray(value.improvements) && { improvements: [...value.improvements] }),
    ...(isStringArray(value.injectedSkills) && { injectedSkills: [...value.injectedSkills] }),
    ...(isPlainObject(value.injected) && { injected: readInjected(value.injected) ?? {} }),
    ...(isPlainObject(value.results) && { results: readResults(value.results) }),
    ...(value.policy !== undefined && isPolicy(value.policy, states) && { policy: value.policy }),
    ...(value.signalsPolicy !== undefined && isSignalsPolicy(value.signalsPolicy) && { signalsPolicy: value.signalsPolicy }),
    ...(value.failure !== undefined && isFailure(value.failure) && { failure: value.failure }),
  }

  return stored
}

type SnapshotField
  = | 'sessionId'
    | 'goal'
    | 'intent'
    | 'attempts'
    | 'memories'
    | 'improvements'
    | 'injectedSkills'
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
  memories: snapshot => [...(snapshot.memories ?? [])],
  improvements: snapshot => [...(snapshot.improvements ?? [])],
  injectedSkills: snapshot => [...(snapshot.injectedSkills ?? [])],
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
