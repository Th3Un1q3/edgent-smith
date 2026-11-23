import type { EntryFailureReason } from './carrier-failure'
import type { EntryStatus, InstructionEntry, InstructionValueObject } from '../helpers/instructions/entry-client'

export type LoaderOutcome = 'published' | 'skipped' | 'fallback' | 'degraded'

export type InjectionCarrier = 'native' | 'synthetic'

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

export type LedgerEntry = InstructionEntryDraft

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
