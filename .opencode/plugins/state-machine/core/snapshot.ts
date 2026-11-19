/**
 * The session snapshot: one JSON value per session under `state-machine/<id>`,
 * written on every change and read once on a session's first access after a
 * reload. An expired, malformed or missing record is treated as absent; only a
 * rejected storage call is reported as such, and it creates no machine.
 */
import { Effect } from 'effect'

import { LOOP_STATE_IDS } from './machine'

import type {
  CallbackPayload,
  Failure,
  InjectedMemories,
  IntentKind,
  LoopStateId,
} from './machine'

export const SNAPSHOT_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Only free text that a person typed is capped; memories are idempotency keys
 * (`mem:<path>:complete`, `skill:<name>:complete`) and results are kept whole so
 * a workflow can read the command output it asked for.
 */
export const OUTPUT_LIMIT = 1024

export interface ToolPolicyRule {
  readonly stateId: LoopStateId
  readonly errorMessage: string
  readonly allowedTools: readonly string[]
}

export interface SessionSnapshot {
  readonly sessionId: string
  readonly state: LoopStateId
  readonly goal: string
  readonly intent: IntentKind
  readonly attempts: number
  readonly idleCount: number
  readonly memories: readonly string[]
  readonly improvements: readonly string[]
  readonly injectedSkills: readonly string[]
  readonly injected: Readonly<Record<string, InjectedMemories>>
  readonly results: Readonly<Record<string, CallbackPayload>>
  readonly policy?: ToolPolicyRule
  readonly failure?: Failure
  readonly updatedAt: string
}

export interface SnapshotRecord {
  readonly sessionId: string
  readonly payload: SessionSnapshot
  readonly storedAt: string
  readonly expiresAt: string
}

export type AbsentReason = 'missing' | 'expired' | 'shape-invalid'

export type SnapshotRead
  = | { readonly status: 'present', readonly record: SnapshotRecord }
    | { readonly status: 'absent', readonly reason: AbsentReason }
    | { readonly status: 'rejected', readonly reason: string }

export const snapshotKey = (sessionId: string): string => 'state-machine/' + sessionId

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

const INTENT_KINDS: readonly IntentKind[] = ['none', 'improvement', 'lesson']

const isIntentKind = (value: unknown): value is IntentKind =>
  typeof value === 'string' && (INTENT_KINDS as readonly string[]).includes(value)

const isStateId = (value: unknown): value is LoopStateId =>
  typeof value === 'string' && (LOOP_STATE_IDS as readonly string[]).includes(value)

const isInjectedMemories = (value: unknown): value is InjectedMemories =>
  isObject(value) && isStringArray(value.full) && isStringArray(value.index)

const isPolicy = (value: unknown): value is ToolPolicyRule =>
  isObject(value)
  && isStateId(value.stateId)
  && typeof value.errorMessage === 'string'
  && isStringArray(value.allowedTools)

const isFailure = (value: unknown): value is Failure =>
  isObject(value)
  && typeof value.reason === 'string'
  && (value.detail === undefined || typeof value.detail === 'string')

const isCallbackPayload = (value: unknown): value is CallbackPayload =>
  isObject(value)
  && typeof value.ok === 'boolean'
  && (value.exitCode === undefined || typeof value.exitCode === 'number')
  && (value.output === undefined || typeof value.output === 'string')
  && (value.value === undefined || isInjectedMemories(value.value))

const readInjected = (value: unknown): Record<string, InjectedMemories> | undefined => {
  if (!isObject(value)) return undefined

  const entries = Object.entries(value)

  return entries.every(([, item]) => isInjectedMemories(item))
    ? entries.reduce<Record<string, InjectedMemories>>((all, [key, item]) => {
        all[key] = item as InjectedMemories
        return all
      }, {})
    : undefined
}

const readResults = (value: unknown): Record<string, CallbackPayload> | undefined => {
  if (!isObject(value)) return undefined

  const entries = Object.entries(value)

  return entries.every(([, item]) => isCallbackPayload(item))
    ? entries.reduce<Record<string, CallbackPayload>>((all, [key, item]) => {
        all[key] = item as CallbackPayload
        return all
      }, {})
    : undefined
}

const readSnapshot = (value: Record<string, unknown>): SessionSnapshot | undefined => {
  if (typeof value.sessionId !== 'string' || value.sessionId === '') return undefined
  if (!isStateId(value.state)) return undefined
  if (typeof value.goal !== 'string') return undefined
  if (!isIntentKind(value.intent)) return undefined
  if (typeof value.attempts !== 'number' || typeof value.idleCount !== 'number') return undefined
  if (!isStringArray(value.memories) || !isStringArray(value.improvements)) return undefined
  if (!isStringArray(value.injectedSkills)) return undefined
  if (value.policy !== undefined && !isPolicy(value.policy)) return undefined
  if (value.failure !== undefined && !isFailure(value.failure)) return undefined
  if (typeof value.updatedAt !== 'string') return undefined

  const injected = readInjected(value.injected)
  const results = readResults(value.results)

  return injected === undefined || results === undefined
    ? undefined
    : {
        sessionId: value.sessionId,
        state: value.state,
        goal: value.goal,
        intent: value.intent,
        attempts: value.attempts,
        idleCount: value.idleCount,
        memories: value.memories,
        improvements: value.improvements,
        injectedSkills: value.injectedSkills,
        injected,
        results,
        ...(value.policy !== undefined && { policy: value.policy }),
        ...(value.failure !== undefined && { failure: value.failure }),
        updatedAt: value.updatedAt,
      }
}

const truncate = (text: string, limit: number): string => text.length <= limit ? text : text.slice(0, limit)

/**
 * Rebuilds the allowlisted snapshot. Every other key on the input, including a
 * credential accidentally added to the context, is dropped.
 */
export const boundSnapshot = (snapshot: SessionSnapshot): SessionSnapshot => ({
  sessionId: snapshot.sessionId,
  state: snapshot.state,
  goal: truncate(snapshot.goal, OUTPUT_LIMIT),
  intent: snapshot.intent,
  attempts: snapshot.attempts,
  idleCount: snapshot.idleCount,
  memories: [...snapshot.memories],
  improvements: [...snapshot.improvements],
  injectedSkills: [...snapshot.injectedSkills],
  injected: Object.fromEntries(
    Object.entries(snapshot.injected).map(([key, value]) => [key, { full: [...value.full], index: [...value.index] }]),
  ),
  results: Object.fromEntries(
    Object.entries(snapshot.results).map(([key, value]) => [key, { ...value }]),
  ),
  policy: snapshot.policy,
  failure: snapshot.failure === undefined
    ? undefined
    : {
        reason: truncate(snapshot.failure.reason, OUTPUT_LIMIT),
        ...(snapshot.failure.detail !== undefined && { detail: truncate(snapshot.failure.detail, OUTPUT_LIMIT) }),
      },
  updatedAt: snapshot.updatedAt,
})

export const createSnapshotRecord = (snapshot: SessionSnapshot, now: number): SnapshotRecord => {
  const storedAt = new Date(now).toISOString()

  return {
    sessionId: snapshot.sessionId,
    payload: boundSnapshot({ ...snapshot, updatedAt: storedAt }),
    storedAt,
    expiresAt: new Date(now + SNAPSHOT_TTL_MS).toISOString(),
  }
}

export const isExpired = (record: SnapshotRecord, now: number): boolean => {
  const expiry = Date.parse(record.expiresAt)

  return Number.isNaN(expiry) || expiry <= now
}

/**
 * Returns the record, or the two reasons a record is treated as absent. Only a
 * rejected storage call is a different outcome, and that is the store's.
 */
export const parseSnapshotRecord = (
  value: unknown,
  now: number,
): SnapshotRecord | 'expired' | 'shape-invalid' => {
  if (!isObject(value) || typeof value.sessionId !== 'string' || value.sessionId === '' || typeof value.storedAt !== 'string' || typeof value.expiresAt !== 'string' || !isObject(value.payload)) return 'shape-invalid'

  const payload = readSnapshot(value.payload)

  if (payload === undefined) return 'shape-invalid'

  const record: SnapshotRecord = {
    sessionId: value.sessionId,
    payload,
    storedAt: value.storedAt,
    expiresAt: value.expiresAt,
  }

  return isExpired(record, now) ? 'expired' : record
}

export interface SnapshotStorePorts {
  readonly load: (key: string) => Effect.Effect<unknown, unknown>
  readonly save: (key: string, value: unknown) => Effect.Effect<void, unknown>
  readonly now?: () => number
}

export interface SnapshotStore {
  readonly read: (sessionId: string) => Effect.Effect<SnapshotRead>
  /**
  `false` means the write was rejected and the previous value stands.
  */
  readonly write: (snapshot: SessionSnapshot) => Effect.Effect<boolean>
}

const describe = (cause: unknown): string => cause instanceof Error ? cause.name : 'unknown'

export const createSnapshotStore = (ports: SnapshotStorePorts): SnapshotStore => {
  const now = ports.now ?? Date.now

  return {
    read: sessionId => ports.load(snapshotKey(sessionId)).pipe(
      Effect.match({
        onFailure: cause => ({ status: 'rejected', reason: 'read-failed:' + describe(cause) }) as const,
        onSuccess: (value): SnapshotRead => {
          if (value === undefined || value === null) return { status: 'absent', reason: 'missing' }

          const parsed = parseSnapshotRecord(value, now())

          if (parsed === 'expired') return { status: 'absent', reason: 'expired' }
          return parsed === 'shape-invalid' ? { status: 'absent', reason: 'shape-invalid' } : { status: 'present', record: parsed }
        },
      }),
    ),
    write: snapshot => Effect.suspend(() => ports.save(
      snapshotKey(snapshot.sessionId),
      createSnapshotRecord(snapshot, now()),
    )).pipe(
      Effect.match({ onFailure: () => false, onSuccess: () => true }),
    ),
  }
}
