import {
  ClientError,
  isForbiddenError,
  isInstructionEntryValueTooLargeError,
  isSessionNotFoundError,
  isUnauthorizedError,
} from '@opencode/client'

import type { EntryResult } from '../helpers/instructions/entry-client'

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

const CLASSIFIERS: readonly (readonly [(error: unknown) => boolean, EntryFailureReason])[] = [
  [isDiscoveryFailure, 'discovery'],
  [isUnauthorizedError, 'unauthorized'],
  [isForbiddenError, 'forbidden'],
  [isSessionNotFoundError, 'session-not-found'],
  [isInstructionEntryValueTooLargeError, 'oversize'],
  [isTransportFailure, 'transport'],
]

const firstMatchingReason = (error: unknown): EntryFailureReason | undefined =>
  error instanceof InstructionCarrierUnavailableError
    ? error.reason
    : CLASSIFIERS.find(([matches]) => matches(error))?.[1]

export const classifyEntryFailure = (error: unknown): EntryFailureReason =>
  firstMatchingReason(error) ?? 'unknown'

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

export const failureReasonOf = (result: EntryResult): EntryFailureReason =>
  result.reason ?? classifyEntryFailure(result.cause)

export const carrierReasonOf = (result: EntryResult): EntryFailureReason | undefined => {
  const reason = failureReasonOf(result)
  return isCarrierUnavailableReason(reason) ? reason : undefined
}
