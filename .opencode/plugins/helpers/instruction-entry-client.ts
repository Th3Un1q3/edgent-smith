import type { EntryFailureReason } from './instruction-carrier'
import { stripApiPrefix } from './instruction-payload'
import { getClient } from './service-client'

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

const isPriority = (value: unknown): value is InstructionValueObject['priority'] =>
  typeof value === 'number' && [0, 1, 2].includes(value)

export const isValueObject = (value: unknown): value is InstructionValueObject => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.text === 'string'
    && typeof candidate.source === 'string'
    && isPriority(candidate.priority)
}

export const isEntryValueCurrent = (entry: InstructionEntry | undefined, value: InstructionValue): boolean => {
  if (entry === undefined) return false
  if (typeof value === 'string') return entry.value === value
  const stored = entry.value
  return isValueObject(stored)
    && stored.text === value.text
    && stored.source === value.source
    && stored.priority === value.priority
}

const snapshotEntry = (snapshot: readonly InstructionEntry[], key: string): InstructionEntry | undefined =>
  snapshot.find(entry => stripApiPrefix(entry.key) === key)

const recordWritten = (snapshot: InstructionEntry[], key: string, value: InstructionValue): void => {
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
): Promise<EntryResult> => {
  const bare = stripApiPrefix(key)
  try {
    if (entryValueBytes(value) > MAX_ENTRY_VALUE_BYTES) {
      return { status: 'failed', reason: 'oversize' }
    }
    const existing = snapshot === undefined
      ? await findEntry(sessionID, key, directory)
      : snapshotEntry(snapshot, bare)
    if (isEntryValueCurrent(existing, value)) return { status: 'unchanged' }
    const client = await getClient(undefined, directory)
    await client.session.instructions.entry.put({ sessionID, key: bare, value })
    if (snapshot !== undefined) recordWritten(snapshot, bare, value)
    return { status: 'written' }
  }
  catch (error) {
    return { status: 'failed', error: describeError(error), cause: error }
  }
}

export const removeEntry = async (
  sessionID: string,
  key: string,
  snapshot?: InstructionEntry[],
  directory?: string,
): Promise<EntryResult> => {
  const bare = stripApiPrefix(key)
  try {
    const existing = snapshot === undefined
      ? await findEntry(sessionID, key, directory)
      : snapshotEntry(snapshot, bare)
    if (existing === undefined) return { status: 'absent' }
    const client = await getClient(undefined, directory)
    await client.session.instructions.entry.remove({ sessionID, key: bare })
    if (snapshot !== undefined) recordRemoved(snapshot, bare)
    return { status: 'removed' }
  }
  catch (error) {
    return { status: 'failed', error: describeError(error), cause: error }
  }
}
