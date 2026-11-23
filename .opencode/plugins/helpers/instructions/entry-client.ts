import type { EntryFailureReason } from '../../instructions/carrier'
import { stripApiPrefix } from './payload'
import { getClient } from '../runtime/service-client'

/**
 * Session instruction entries (ADR-011) as a plugin-side carrier.
 *
 * Plugin hooks receive no client, so the server is reached through the shared
 * loopback resolver in service-client.ts.
 */

export const MAX_ENTRY_VALUE_BYTES = 256 * 1024

export const entryValueBytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8')

export interface InstructionEntry {
  readonly key: string
  readonly value: unknown
}

export type InstructionValueObject = {
  readonly text: string
  readonly source: string
  readonly priority: 0 | 1 | 2
}

export type InstructionValue = string | InstructionValueObject

export type EntryStatus = 'written' | 'unchanged' | 'removed' | 'absent' | 'failed'

export interface EntryResult {
  readonly status: EntryStatus
  readonly error?: string
  readonly reason?: EntryFailureReason
  readonly cause?: unknown
}

export const listEntries = async (sessionID: string, directory?: string): Promise<InstructionEntry[]> => {
  const client = await getClient(undefined, directory)
  const entries = await client.session.instructions.entry.list({ sessionID })
  return entries.map(entry => ({ key: stripApiPrefix(entry.key), value: entry.value }))
}

export const findEntry = async (
  sessionID: string,
  key: string,
  directory?: string,
): Promise<InstructionEntry | undefined> => {
  const bare = stripApiPrefix(key)
  const entries = await listEntries(sessionID, directory)
  return entries.find(entry => stripApiPrefix(entry.key) === bare)
}

const describeError = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

const attempt = async (action: () => Promise<EntryResult>): Promise<EntryResult> => {
  try {
    return await action()
  }
  catch (error) {
    return { status: 'failed', error: describeError(error), cause: error }
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isPriority = (value: unknown): value is InstructionValueObject['priority'] =>
  typeof value === 'number' && [0, 1, 2].includes(value)

const VALUE_STRING_KEYS = ['text', 'source'] as const

const hasValueShape = (value: Record<string, unknown>): boolean =>
  VALUE_STRING_KEYS.every(key => typeof value[key] === 'string') && isPriority(value.priority)

export const isValueObject = (value: unknown): value is InstructionValueObject =>
  isRecord(value) && hasValueShape(value)

const VALUE_KEYS = ['text', 'source', 'priority'] as const

const isSameValue = (stored: unknown, value: InstructionValueObject): boolean =>
  isValueObject(stored) && VALUE_KEYS.every(key => stored[key] === value[key])

export const isEntryValueCurrent = (entry: InstructionEntry | undefined, value: InstructionValue): boolean => {
  if (entry === undefined) return false

  return typeof value === 'string' ? entry.value === value : isSameValue(entry.value, value)
}

const snapshotEntry = (snapshot: readonly InstructionEntry[], key: string): InstructionEntry | undefined =>
  snapshot.find(entry => stripApiPrefix(entry.key) === key)

const existingEntry = async (
  sessionID: string,
  key: string,
  bare: string,
  snapshot: InstructionEntry[] | undefined,
  directory?: string,
): Promise<InstructionEntry | undefined> =>
  snapshot === undefined ? await findEntry(sessionID, key, directory) : snapshotEntry(snapshot, bare)

const recordWritten = (snapshot: InstructionEntry[] | undefined, key: string, value: InstructionValue): void => {
  if (snapshot === undefined) return
  const index = snapshot.findIndex(entry => stripApiPrefix(entry.key) === key)
  if (index === -1) snapshot.push({ key, value })
  else snapshot[index] = { key, value }
}

const recordRemoved = (snapshot: InstructionEntry[], key: string): void => {
  const index = snapshot.findIndex(entry => stripApiPrefix(entry.key) === key)
  if (index !== -1) snapshot.splice(index, 1)
}

export const writeEntry = async (
  sessionID: string,
  key: string,
  value: InstructionValue,
  snapshot?: InstructionEntry[],
  directory?: string,
): Promise<EntryResult> =>
  attempt(async () => {
    if (entryValueBytes(value) > MAX_ENTRY_VALUE_BYTES) {
      return { status: 'failed', reason: 'oversize' }
    }
    const bare = stripApiPrefix(key)
    const existing = await existingEntry(sessionID, key, bare, snapshot, directory)
    if (isEntryValueCurrent(existing, value)) return { status: 'unchanged' }
    const client = await getClient(undefined, directory)
    await client.session.instructions.entry.put({ sessionID, key: bare, value })
    recordWritten(snapshot, bare, value)
    return { status: 'written' }
  })

export const removeEntry = async (
  sessionID: string,
  key: string,
  snapshot?: InstructionEntry[],
  directory?: string,
): Promise<EntryResult> =>
  attempt(async () => {
    const bare = stripApiPrefix(key)
    const existing = await existingEntry(sessionID, key, bare, snapshot, directory)
    if (existing === undefined) return { status: 'absent' }
    const client = await getClient(undefined, directory)
    await client.session.instructions.entry.remove({ sessionID, key: bare })
    if (snapshot !== undefined) recordRemoved(snapshot, bare)
    return { status: 'removed' }
  })
