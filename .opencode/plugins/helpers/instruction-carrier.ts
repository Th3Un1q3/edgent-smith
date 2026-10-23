import {
  ClientError,
  isForbiddenError,
  isInstructionEntryValueTooLargeError,
  isSessionNotFoundError,
  isUnauthorizedError,
} from '@opencode/client'

import { entryValueBytes, isValueObject, removeEntry, writeEntry } from './instruction-entry-client'
import type { EntryResult, EntryStatus, InstructionEntry, InstructionValueObject } from './instruction-entry-client'

export type EntryFailureReason
  = | 'method-absent'
    | 'discovery'
    | 'unauthorized'
    | 'forbidden'
    | 'session-not-found'
    | 'oversize'
    | 'transport'
    | 'unknown'

/**
Marks a failure the loader may answer with the synthetic carrier; `reason` is the D-06 row.
*/
export class InstructionCarrierUnavailableError extends Error {
  readonly reason: EntryFailureReason

  constructor(reason: EntryFailureReason, options?: ErrorOptions) {
    super(`instruction carrier unavailable: ${reason}`, options)
    this.name = 'InstructionCarrierUnavailableError'
    this.reason = reason
  }
}

const CARRIER_REASONS: ReadonlySet<EntryFailureReason> = new Set([
  'method-absent',
  'discovery',
  'unauthorized',
  'forbidden',
  'session-not-found',
  'transport',
])

// service-client rejects discovery with a plain Error carrying this fixed prefix; no status is parsed.
const isDiscoveryFailure = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith('no service:')

const isTransportFailure = (error: unknown): boolean =>
  error instanceof ClientError && error.reason === 'UnexpectedStatus'

export const classifyEntryFailure = (error: unknown): EntryFailureReason => {
  if (error instanceof InstructionCarrierUnavailableError) return error.reason
  if (isDiscoveryFailure(error)) return 'discovery'
  if (isUnauthorizedError(error)) return 'unauthorized'
  if (isForbiddenError(error)) return 'forbidden'
  if (isSessionNotFoundError(error)) return 'session-not-found'
  if (isInstructionEntryValueTooLargeError(error)) return 'oversize'
  return isTransportFailure(error) ? 'transport' : 'unknown'
}

export const isCarrierUnavailableReason = (reason: EntryFailureReason): boolean =>
  CARRIER_REASONS.has(reason)

/**
 * Wraps rows 1-5 and 8. Rows 6, 7 and 9 stay out of the carrier error: this
 * rethrows them so the caller keeps its oversize or skip decision.
 */
export const toCarrierError = (error: unknown): InstructionCarrierUnavailableError => {
  const reason = classifyEntryFailure(error)
  if (!CARRIER_REASONS.has(reason)) throw error
  return error instanceof InstructionCarrierUnavailableError
    ? error
    : new InstructionCarrierUnavailableError(reason, { cause: error })
}

export type LoaderOutcome = 'published' | 'skipped' | 'fallback' | 'degraded'

export type InjectionCarrier = 'native' | 'synthetic'

const rejectedFlagValues = new Set<string>()

const warn = (message: string): void => {
  process.emitWarning(`[instructions-loader] ${message}`)
}

export const resolveInjectionCarrier = (
  environment: Record<string, string | undefined>,
  agent: string,
): InjectionCarrier => {
  const value = environment.INSTRUCTION_INJECTION
  if (value === 'synthetic') return 'synthetic'
  if (value !== undefined && value !== '' && value !== 'native' && !rejectedFlagValues.has(value)) {
    rejectedFlagValues.add(value)
    warn(`unknown INSTRUCTION_INJECTION value "${value}" for agent ${agent}; using native`)
  }
  return 'native'
}

export interface InstructionReferenceDraft {
  readonly key: string
  readonly value: InstructionValueObject
}

export interface InstructionEntryDraft {
  readonly identity: string
  readonly key: string
  readonly value: InstructionValueObject
  readonly reference?: InstructionReferenceDraft
}

export interface PublishStatus {
  readonly identity: string
  readonly key: string
  readonly status: EntryStatus | 'skipped'
  readonly reason?: EntryFailureReason
}

export interface PublishResult {
  readonly outcome: LoaderOutcome
  readonly published: readonly string[]
  readonly statuses: readonly PublishStatus[]
}

/**
Plugin storage the carrier needs for the ledger and warning latches. The loader
adapts `context.storage`; callers that omit it get process memory, so a ledger
survives repeated calls in one process but not a restart.
*/
export interface CarrierStorage {
  get(key: string): Promise<unknown> | unknown
  set(key: string, value: unknown): Promise<void> | void
  remove(key: string): Promise<void> | void
}

export interface PublishRequest {
  readonly sessionID: string
  readonly directory: string
  readonly entries: readonly InstructionEntryDraft[]
  readonly removals: readonly string[]
  readonly snapshot: readonly InstructionEntry[]
  readonly storage?: CarrierStorage
}

type LedgerEntry = InstructionEntryDraft

const MAX_LEDGER_ENTRIES = 16
const MAX_LEDGER_BYTES = 96 * 1024

const ledgerKey = (sessionID: string): string => `instruction-carrier/${sessionID}.unpublished`
const warningKey = (sessionID: string): string => `instruction-carrier/${sessionID}`

const memoryState = new Map<string, unknown>()

const MEMORY_STORAGE: CarrierStorage = {
  get: key => memoryState.get(key),
  set: (key, value) => { memoryState.set(key, value) },
  remove: (key) => { memoryState.delete(key) },
}

const isLedgerEntry = (entry: unknown): entry is LedgerEntry => {
  if (typeof entry !== 'object' || entry === null) return false
  const candidate = entry as Record<string, unknown>
  return typeof candidate.identity === 'string'
    && typeof candidate.key === 'string'
    && isValueObject(candidate.value)
}

const readLedger = async (storage: CarrierStorage, sessionID: string): Promise<LedgerEntry[]> => {
  const stored = await storage.get(ledgerKey(sessionID))
  if (typeof stored !== 'object' || stored === null) return []
  const entries = (stored as { entries?: unknown }).entries
  return Array.isArray(entries) ? entries.filter(isLedgerEntry) : []
}

const readWarnedReasons = async (storage: CarrierStorage, sessionID: string): Promise<string[]> => {
  const stored = await storage.get(warningKey(sessionID))
  if (typeof stored !== 'object' || stored === null) return []
  const reasons = (stored as { reasons?: unknown }).reasons
  return Array.isArray(reasons)
    ? reasons.filter((reason): reason is string => typeof reason === 'string')
    : []
}

const warnOnce = async (
  storage: CarrierStorage,
  sessionID: string,
  reason: string,
  message: string,
): Promise<void> => {
  const warned = await readWarnedReasons(storage, sessionID)
  if (warned.includes(reason)) return
  warn(message)
  await storage.set(warningKey(sessionID), { version: 1, reasons: [...warned, reason] })
}

const failureReasonOf = (result: EntryResult): EntryFailureReason =>
  result.reason ?? classifyEntryFailure(result.cause)

const carrierReasonOf = (result: EntryResult): EntryFailureReason | undefined => {
  const reason = failureReasonOf(result)
  return isCarrierUnavailableReason(reason) ? reason : undefined
}

const commitLedger = async (
  storage: CarrierStorage,
  sessionID: string,
  entries: readonly LedgerEntry[],
): Promise<void> => {
  if (entries.length === 0) {
    await storage.remove(ledgerKey(sessionID))
    return
  }
  await storage.set(ledgerKey(sessionID), { version: 1, entries })
}

const capLedger = async (
  storage: CarrierStorage,
  sessionID: string,
  entries: readonly LedgerEntry[],
): Promise<LedgerEntry[]> => {
  const capped: LedgerEntry[] = []
  for (const entry of entries) {
    if (entryValueBytes(entry) > MAX_LEDGER_BYTES) {
      await warnOnce(
        storage,
        sessionID,
        'ledger-entry-too-large',
        `ledger entry for ${entry.identity} exceeds ${MAX_LEDGER_BYTES} bytes; dropped`,
      )
      continue
    }
    capped.push(entry)
    while (capped.length > MAX_LEDGER_ENTRIES || entryValueBytes(capped) > MAX_LEDGER_BYTES) capped.shift()
  }
  return capped
}

const mergeLedger = (
  survivors: readonly LedgerEntry[],
  recorded: readonly LedgerEntry[],
): LedgerEntry[] => {
  const merged: LedgerEntry[] = []
  const add = (entry: LedgerEntry): void => {
    const existing = merged.findIndex(candidate => candidate.identity === entry.identity)
    if (existing !== -1) merged.splice(existing, 1)
    merged.push(entry)
  }
  for (const entry of survivors) add(entry)
  for (const entry of recorded) add(entry)
  return merged
}

interface PublishState {
  committed: boolean
  fallback: boolean
  degraded: boolean
  skipped: boolean
  oversize: boolean
}

interface FailureAction {
  readonly status: PublishStatus
  readonly fallback: boolean
  readonly degraded: boolean
  readonly skipped: boolean
  readonly oversize: boolean
}

const outcomeOf = (state: PublishState): LoaderOutcome => {
  if (state.fallback) return 'fallback'
  if (state.degraded) return 'degraded'
  if (state.skipped) return 'skipped'
  return state.committed || state.oversize ? 'published' : 'skipped'
}

const classifyDraftFailure = (
  draft: LedgerEntry,
  result: EntryResult,
  isCommitted: boolean,
): FailureAction => {
  const reason = failureReasonOf(result)
  if (reason === 'oversize') {
    return {
      status: { identity: draft.identity, key: draft.key, status: 'failed', reason },
      fallback: false,
      degraded: false,
      skipped: false,
      oversize: true,
    }
  }
  const carrierReason = carrierReasonOf(result)
  const status: PublishStatus = carrierReason === undefined
    ? { identity: draft.identity, key: draft.key, status: 'skipped', reason }
    : { identity: draft.identity, key: draft.key, status: 'failed', reason: carrierReason }
  return {
    status,
    fallback: carrierReason !== undefined && !isCommitted,
    degraded: isCommitted,
    skipped: carrierReason === undefined && !isCommitted,
    oversize: false,
  }
}

const SETTLED_STATUSES: ReadonlySet<PublishStatus['status']> = new Set(['written', 'unchanged', 'removed'])

const ledgerSurvivors = (
  ledger: readonly LedgerEntry[],
  statuses: readonly PublishStatus[],
): LedgerEntry[] => {
  const survivors: LedgerEntry[] = []
  for (const [index, entry] of ledger.entries()) {
    const status = statuses[index]?.status
    if (status !== undefined && SETTLED_STATUSES.has(status)) continue
    survivors.push(entry)
  }
  return survivors
}

const recordedFailures = (
  drafts: readonly LedgerEntry[],
  statuses: readonly PublishStatus[],
  ledgerLength: number,
  outcome: LoaderOutcome,
): LedgerEntry[] => {
  if (outcome !== 'degraded') return []
  const recorded: LedgerEntry[] = []
  for (const [offset, draft] of drafts.slice(ledgerLength).entries()) {
    const status = statuses[ledgerLength + offset]
    if ((status === undefined) || status.status === 'written' || status.status === 'unchanged' || (status.reason === 'oversize')) continue
    recorded.push({ identity: draft.identity, key: draft.key, value: draft.value })
  }
  return recorded
}

const applyRemovals = async (
  request: PublishRequest,
  storage: CarrierStorage,
  outcome: LoaderOutcome,
  snapshot: InstructionEntry[],
  removals: readonly string[],
): Promise<void> => {
  if (outcome !== 'published') return
  for (const key of new Set(removals)) {
    const result = await removeEntry(request.sessionID, key, snapshot, request.directory)
    if (result.status !== 'failed') continue
    const reason = failureReasonOf(result)
    await warnOnce(storage, request.sessionID, `remove:${reason}`, `removal of ${key} failed (${reason})`)
  }
}

const markRemainingSkipped = (statuses: PublishStatus[], drafts: readonly LedgerEntry[]): void => {
  for (let index = statuses.length; index < drafts.length; index++) {
    const draft = drafts[index]
    if (draft === undefined) continue
    statuses.push({ identity: draft.identity, key: draft.key, status: 'skipped' })
  }
}

const warnDraftFailure = async (
  storage: CarrierStorage,
  sessionID: string,
  draft: InstructionEntryDraft,
  result: EntryResult,
): Promise<void> => {
  const reason = failureReasonOf(result)
  await warnOnce(
    storage,
    sessionID,
    reason,
    `instruction ${draft.identity} failed (${reason})${result.error === undefined ? '' : `: ${result.error}`}`,
  )
}

const warnOversize = async (
  storage: CarrierStorage,
  sessionID: string,
  identity: string,
  detail: string,
): Promise<void> => {
  await warnOnce(storage, sessionID, 'oversize', `instruction ${identity} exceeds the entry value cap; ${detail}`)
}

const mergeFailureAction = (state: PublishState, action: FailureAction): void => {
  state.fallback ||= action.fallback
  state.degraded ||= action.degraded
  state.skipped ||= action.skipped
  state.oversize ||= action.oversize
}

const publishReference = async (
  request: PublishRequest,
  draft: LedgerEntry,
  reference: InstructionReferenceDraft,
  snapshot: InstructionEntry[],
  storage: CarrierStorage,
  state: PublishState,
  statuses: PublishStatus[],
  published: Set<string>,
  superseded: Set<string>,
): Promise<void> => {
  const result = await writeEntry(request.sessionID, reference.key, reference.value, snapshot, request.directory)
  if (result.status === 'written' || result.status === 'unchanged') {
    state.committed = true
    published.add(draft.identity)
    statuses.push({ identity: draft.identity, key: reference.key, status: result.status })
    superseded.add(draft.key)
    await warnOnce(storage, request.sessionID, 'wrote-reference', `wrote reference ${reference.key}`)
    return
  }
  const reason = failureReasonOf(result)
  statuses.push({ identity: draft.identity, key: draft.key, status: 'skipped', reason })
  state.oversize = true
  await warnOnce(
    storage,
    request.sessionID,
    `reference:${reason}`,
    `instruction ${draft.identity} reference ${reference.key} was not written; skipped`,
  )
}

const publishDrafts = async (
  request: PublishRequest,
  drafts: readonly LedgerEntry[],
  snapshot: InstructionEntry[],
  storage: CarrierStorage,
  state: PublishState,
  superseded: Set<string>,
): Promise<{ readonly statuses: PublishStatus[], readonly published: Set<string> }> => {
  const statuses: PublishStatus[] = []
  const published = new Set<string>()

  for (const draft of drafts) {
    const result = await writeEntry(request.sessionID, draft.key, draft.value, snapshot, request.directory)

    if (result.status === 'written' || result.status === 'unchanged') {
      state.committed = true
      published.add(draft.identity)
      statuses.push({ identity: draft.identity, key: draft.key, status: result.status })
      continue
    }

    if (result.status !== 'failed') {
      statuses.push({ identity: draft.identity, key: draft.key, status: 'skipped' })
      state.skipped = true
      markRemainingSkipped(statuses, drafts)
      break
    }

    const action = classifyDraftFailure(draft, result, state.committed)
    if (action.oversize && draft.reference !== undefined) {
      await publishReference(request, draft, draft.reference, snapshot, storage, state, statuses, published, superseded)
      continue
    }
    statuses.push(action.status)
    mergeFailureAction(state, action)
    if (action.oversize) {
      await warnOversize(storage, request.sessionID, draft.identity, 'skipped')
      continue
    }
    await warnDraftFailure(storage, request.sessionID, draft, result)
    markRemainingSkipped(statuses, drafts)
    break
  }

  return { statuses, published }
}

export const publishInstructionSet = async (request: PublishRequest): Promise<PublishResult> => {
  const storage = request.storage ?? MEMORY_STORAGE
  const snapshot = [...request.snapshot]
  const ledger = await readLedger(storage, request.sessionID)
  const drafts: readonly LedgerEntry[] = [...ledger, ...request.entries]
  const state: PublishState = {
    committed: false,
    fallback: false,
    degraded: false,
    skipped: false,
    oversize: false,
  }

  const superseded = new Set<string>()
  const { statuses, published } = await publishDrafts(request, drafts, snapshot, storage, state, superseded)
  const outcome = outcomeOf(state)

  await applyRemovals(request, storage, outcome, snapshot, [...request.removals, ...superseded])

  const survivors = ledgerSurvivors(ledger, statuses)
  const recorded = recordedFailures(drafts, statuses, ledger.length, outcome)
  const capped = await capLedger(storage, request.sessionID, mergeLedger(survivors, recorded))
  await commitLedger(storage, request.sessionID, capped)

  return { outcome, published: [...published], statuses }
}
