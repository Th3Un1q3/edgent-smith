import { removeEntry, writeEntry } from '../helpers/instructions/entry-client'
import type { EntryResult, InstructionEntry } from '../helpers/instructions/entry-client'
import { carrierReasonOf, failureReasonOf } from './carrier-failure'
import type { EntryFailureReason } from './carrier-failure'
import { capLedger, commitLedger, MEMORY_STORAGE, mergeLedger, readLedger } from './carrier-ledger'
import type {
  CarrierStorage,
  InstructionEntryDraft,
  InstructionReferenceDraft,
  LedgerEntry,
  LoaderOutcome,
  PublishRequest,
  PublishResult,
  PublishStatus,
} from './carrier-contract'
import { warnOnce } from './carrier-warnings'

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

const PRIORITY_OUTCOMES = ['fallback', 'degraded', 'skipped'] as const

const isCommittedOrOversize = (state: PublishState): boolean => state.committed || state.oversize

const outcomeOf = (state: PublishState): LoaderOutcome =>
  PRIORITY_OUTCOMES.find(name => state[name])
  ?? (isCommittedOrOversize(state) ? 'published' : 'skipped')

const failureStatus = (
  draft: LedgerEntry,
  reason: EntryFailureReason,
  carrierReason: EntryFailureReason | undefined,
): PublishStatus => carrierReason === undefined
  ? { identity: draft.identity, key: draft.key, status: 'skipped', reason }
  : { identity: draft.identity, key: draft.key, status: 'failed', reason: carrierReason }

const failureFlags = (
  hasCarrier: boolean,
  isCommitted: boolean,
): Pick<FailureAction, 'fallback' | 'degraded' | 'skipped'> => ({
  fallback: hasCarrier && !isCommitted,
  degraded: isCommitted,
  skipped: !hasCarrier && !isCommitted,
})

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
  return {
    status: failureStatus(draft, reason, carrierReason),
    ...failureFlags(carrierReason !== undefined, isCommitted),
    oversize: false,
  }
}

const SETTLED_STATUSES: ReadonlySet<PublishStatus['status']> = new Set(['written', 'unchanged', 'removed'])

const STORED_STATUSES: ReadonlySet<PublishStatus['status']> = new Set(['written', 'unchanged'])

const isSettled = (status: PublishStatus | undefined): boolean =>
  status !== undefined && SETTLED_STATUSES.has(status.status)

const ledgerSurvivors = (
  ledger: readonly LedgerEntry[],
  statuses: readonly PublishStatus[],
): LedgerEntry[] => {
  const survivors: LedgerEntry[] = []
  for (const [index, entry] of ledger.entries()) {
    if (!isSettled(statuses[index])) survivors.push(entry)
  }
  return survivors
}

const isUnrecordedFailure = (status: PublishStatus | undefined): boolean =>
  status === undefined || STORED_STATUSES.has(status.status) || status.reason === 'oversize'

const recordedFailures = (
  drafts: readonly LedgerEntry[],
  statuses: readonly PublishStatus[],
  ledgerLength: number,
  outcome: LoaderOutcome,
): LedgerEntry[] => (outcome === 'degraded'
  ? drafts.slice(ledgerLength)
      .filter((_, offset) => !isUnrecordedFailure(statuses[ledgerLength + offset]))
      .map(draft => ({ identity: draft.identity, key: draft.key, value: draft.value }))
  : [])

const removeOne = async (
  request: PublishRequest,
  storage: CarrierStorage,
  snapshot: InstructionEntry[],
  key: string,
): Promise<void> => {
  const result = await removeEntry(request.sessionID, key, snapshot, request.directory)
  if (result.status !== 'failed') return
  const reason = failureReasonOf(result)
  await warnOnce(storage, request.sessionID, `remove:${reason}`, `removal of ${key} failed (${reason})`)
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
    await removeOne(request, storage, snapshot, key)
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

const FAILURE_FLAGS = ['fallback', 'degraded', 'skipped', 'oversize'] as const

const mergeFailureAction = (state: PublishState, action: FailureAction): void => {
  for (const flag of FAILURE_FLAGS) state[flag] ||= action[flag]
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

const settleOversize = async (
  request: PublishRequest,
  draft: LedgerEntry,
  action: FailureAction,
  snapshot: InstructionEntry[],
  storage: CarrierStorage,
  state: PublishState,
  statuses: PublishStatus[],
  published: Set<string>,
  superseded: Set<string>,
): Promise<void> => {
  if (draft.reference === undefined) {
    statuses.push(action.status)
    await warnOversize(storage, request.sessionID, draft.identity, 'skipped')
    return
  }
  await publishReference(request, draft, draft.reference, snapshot, storage, state, statuses, published, superseded)
}

const settleDraft = async (
  request: PublishRequest,
  drafts: readonly LedgerEntry[],
  draft: LedgerEntry,
  result: EntryResult,
  snapshot: InstructionEntry[],
  storage: CarrierStorage,
  state: PublishState,
  statuses: PublishStatus[],
  published: Set<string>,
  superseded: Set<string>,
): Promise<'continue' | 'break'> => {
  if (result.status !== 'failed') {
    statuses.push({ identity: draft.identity, key: draft.key, status: 'skipped' })
    state.skipped = true
    markRemainingSkipped(statuses, drafts)
    return 'break'
  }
  const action = classifyDraftFailure(draft, result, state.committed)
  mergeFailureAction(state, action)
  if (action.oversize) {
    await settleOversize(request, draft, action, snapshot, storage, state, statuses, published, superseded)
    return 'continue'
  }
  statuses.push(action.status)
  await warnDraftFailure(storage, request.sessionID, draft, result)
  markRemainingSkipped(statuses, drafts)
  return 'break'
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

  const step = async (draft: LedgerEntry): Promise<'continue' | 'break'> => {
    const result = await writeEntry(request.sessionID, draft.key, draft.value, snapshot, request.directory)
    if (STORED_STATUSES.has(result.status)) {
      state.committed = true
      published.add(draft.identity)
      statuses.push({ identity: draft.identity, key: draft.key, status: result.status })
      return 'continue'
    }
    return settleDraft(request, drafts, draft, result, snapshot, storage, state, statuses, published, superseded)
  }

  for (const draft of drafts) {
    const control = await step(draft)
    if (control === 'break') break
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
