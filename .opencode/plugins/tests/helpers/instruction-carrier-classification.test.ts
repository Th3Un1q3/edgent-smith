import { ClientError } from '@opencode/client'
import { describe, expect, it } from 'vitest'

import {
  InstructionCarrierUnavailableError,
  classifyEntryFailure,
  toCarrierError,
} from '@plugins/helpers/instruction-carrier'
import type { EntryFailureReason } from '@plugins/helpers/instruction-carrier'

type Row = readonly [error: unknown, reason: EntryFailureReason]

const methodAbsent = new InstructionCarrierUnavailableError('method-absent')
const discovery = new Error('no service: 0 candidate(s) rejected (env, state registration, /proc socket); last url none')

const rows: readonly Row[] = [
  [methodAbsent, 'method-absent'],
  [discovery, 'discovery'],
  [{ _tag: 'UnauthorizedError' }, 'unauthorized'],
  [{ _tag: 'ForbiddenError' }, 'forbidden'],
  [{ _tag: 'SessionNotFoundError' }, 'session-not-found'],
  [{ _tag: 'InstructionEntryValueTooLargeError' }, 'oversize'],
  [new ClientError('UnexpectedStatus'), 'transport'],
  [new Error('boom'), 'unknown'],
]

const thrownBy = (value: unknown): unknown => {
  try {
    toCarrierError(value)
    return undefined
  }
  catch (error) {
    return error
  }
}

describe('classifyEntryFailure', () => {
  it('classifies every entry failure to exactly one reason', () => {
    const classified = rows.map(row => classifyEntryFailure(row[0]))

    expect(classified).toEqual(rows.map(row => row[1]))
  })
})

describe('toCarrierError', () => {
  it('wraps every carrier-unavailable failure and leaves the size and unknown cases out', () => {
    const carrierRows = rows.filter(row => row[1] !== 'oversize' && row[1] !== 'unknown')

    for (const row of carrierRows) {
      const wrapped = toCarrierError(row[0])

      expect(wrapped).toBeInstanceOf(InstructionCarrierUnavailableError)
      expect(wrapped.reason).toBe(row[1])
    }

    const oversized = { _tag: 'InstructionEntryValueTooLargeError' }
    const unclassifiable = new Error('boom')

    // Row 6 is the local size pre-check: writeEntry returns it as a result, so no error ever reaches the classifier.
    const localPreCheck = { status: 'failed', reason: 'oversize' } as const
    expect(thrownBy(oversized)).toBe(oversized)
    expect(thrownBy(localPreCheck)).toBe(localPreCheck)
    expect(thrownBy(unclassifiable)).toBe(unclassifiable)
  })

  it('keeps the cause of a wrapped failure and returns an already-carried error unchanged', () => {
    const wrapped = toCarrierError(discovery)

    expect(wrapped.cause).toBe(discovery)
    expect(toCarrierError(methodAbsent)).toBe(methodAbsent)
    expect(toCarrierError(wrapped)).toBe(wrapped)
  })
})
