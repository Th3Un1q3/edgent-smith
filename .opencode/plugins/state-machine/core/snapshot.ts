/**
 * The session snapshot: one JSON value per session under `state-machine/<id>`,
 * written on every change and read once on a session's first access after a
 * reload. An expired, malformed or legacy record is treated as absent; only a
 * rejected storage call is reported as such, and it creates no machine.
 *
 * The recorded value is the actor's own persisted snapshot, carried verbatim.
 * The context fields, their text limit and their redaction are the machine
 * module's declaration; this module carries the record envelope and the store
 * without naming any context field of its own.
 */
import { Effect } from 'effect'

import { DEFAULT_SNAPSHOT, DEFAULT_STATE_IDS } from '../machines'

import type { LoopStateId } from './machine'
import type { StoredSession } from '../machines/session/context'

export const SNAPSHOT_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
How one machine declares its stored context: the keys it carries, the text cap,
and the reader that keeps the fields a payload carries and drops what it cannot
validate.
*/
export interface SnapshotCodec {
  readonly limit: number
  readonly fields: readonly string[]
  readonly bound: (snapshot: Readonly<Record<string, unknown>>) => Record<string, unknown>
  readonly read: (payload: Readonly<Record<string, unknown>>, states: ReadonlySet<string>) => Record<string, unknown> | undefined
}

export interface ToolPolicyRule {
  readonly stateId: LoopStateId
  readonly errorMessage: string
  readonly allowedTools: readonly string[]
}

/**
The actor's own persisted snapshot: the state library's shape, carrying `value`,
`status`, `context` and whatever else it wrote. This store never reads a field
of it by name.
*/
export type PersistedSnapshot = Readonly<Record<string, unknown>>

/**
 * The envelope: a schema version, the persisted snapshot, and when it was
 * written and expires. Version 1 carried a flattened context in `payload`
 * instead, and is no longer readable.
 */
export interface SnapshotRecord {
  readonly sessionId: string
  readonly v: 2
  readonly snapshot: PersistedSnapshot
  readonly storedAt: string
  readonly expiresAt: string
}

/**
 * The session machine's snapshot, kept as a name for callers and tests that
 * already import it.
 */
export type SessionSnapshot = StoredSession

export type AbsentReason = 'missing' | 'expired' | 'shape-invalid' | 'legacy'

export type SnapshotRead
  = | { readonly status: 'present', readonly record: SnapshotRecord }
    | { readonly status: 'absent', readonly reason: AbsentReason }
    | { readonly status: 'rejected', readonly reason: string }

export const snapshotKey = (sessionId: string): string => 'state-machine/' + sessionId

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const DEFAULT_STATES: ReadonlySet<string> = new Set(DEFAULT_STATE_IDS)

const sessionIdOf = (snapshot: PersistedSnapshot): string => {
  const context = snapshot.context
  const sessionId = isObject(context) ? context.sessionId : undefined

  if (typeof sessionId !== 'string' || sessionId === '') throw new Error('snapshot context carries no sessionId')

  return sessionId
}

export const createSnapshotRecord = (snapshot: PersistedSnapshot, now: number): SnapshotRecord => {
  const context = DEFAULT_SNAPSHOT.bound(isObject(snapshot.context) ? snapshot.context : {})
  const sessionId = sessionIdOf({ context })
  const storedAt = new Date(now).toISOString()

  return {
    sessionId,
    v: 2,
    snapshot: { ...snapshot, context },
    storedAt,
    expiresAt: new Date(now + SNAPSHOT_TTL_MS).toISOString(),
  }
}

export const isExpired = (record: { readonly expiresAt: string }, now: number): boolean => {
  const expiry = Date.parse(record.expiresAt)

  return Number.isNaN(expiry) || expiry <= now
}

export type SnapshotParse = SnapshotRecord | 'expired' | 'shape-invalid' | 'legacy'

/**
 * Returns the record, or the reasons it is treated as absent. A v1 envelope is
 * reported as `legacy` so the caller can log the migration instead of losing it
 * silently; only a rejected storage call is a different outcome, and that is
 * the store's.
 */
export const parseSnapshotRecord = (
  value: unknown,
  now: number,
  states: ReadonlySet<string> = DEFAULT_STATES,
  expectedSessionId?: string,
): SnapshotParse => {
  if (!isObject(value)) return 'shape-invalid'
  if (value.v !== 2) return value.v === 1 || value.v === undefined ? 'legacy' : 'shape-invalid'
  if (typeof value.sessionId !== 'string' || value.sessionId === '' || (expectedSessionId !== undefined && value.sessionId !== expectedSessionId) || typeof value.storedAt !== 'string' || typeof value.expiresAt !== 'string' || !isObject(value.snapshot) || typeof value.snapshot.status !== 'string' || !isObject(value.snapshot.context)) return 'shape-invalid'

  const context = DEFAULT_SNAPSHOT.read(value.snapshot.context, states)

  if (context === undefined || context.sessionId !== value.sessionId) return 'shape-invalid'

  const record: SnapshotRecord = {
    sessionId: value.sessionId,
    v: 2,
    snapshot: { ...value.snapshot, context },
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
  /**
   * A read validates the stored context against the states of the machine it is
   * restoring into; a caller that passes none gets the machine entry's set.
   */
  readonly read: (sessionId: string, states?: ReadonlySet<string>) => Effect.Effect<SnapshotRead>
  /**
   * `false` means the write was rejected and the previous value stands.
   */
  readonly write: (snapshot: PersistedSnapshot) => Effect.Effect<boolean>
}

const describe = (cause: unknown): string => cause instanceof Error ? cause.name : 'unknown'

export const createSnapshotStore = (ports: SnapshotStorePorts): SnapshotStore => {
  const now = ports.now ?? Date.now

  return {
    read: (sessionId, states = DEFAULT_STATES) => ports.load(snapshotKey(sessionId)).pipe(
      Effect.match({
        onFailure: cause => ({ status: 'rejected', reason: 'read-failed:' + describe(cause) }) as const,
        onSuccess: (value): SnapshotRead => {
          if (value === undefined || value === null) return { status: 'absent', reason: 'missing' }

          const parsed = parseSnapshotRecord(value, now(), states, sessionId)

          if (parsed === 'expired') return { status: 'absent', reason: 'expired' }
          if (parsed === 'legacy') return { status: 'absent', reason: 'legacy' }
          return parsed === 'shape-invalid' ? { status: 'absent', reason: 'shape-invalid' } : { status: 'present', record: parsed }
        },
      }),
    ),
    write: snapshot => Effect.suspend(() => ports.save(
      snapshotKey(sessionIdOf(snapshot)),
      createSnapshotRecord(snapshot, now()),
    )).pipe(
      Effect.matchCause({ onFailure: () => false, onSuccess: () => true }),
    ),
  }
}
