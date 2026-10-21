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

export type EntryStatus = 'written' | 'unchanged' | 'removed' | 'absent' | 'failed'

export interface EntryResult {
  readonly status: EntryStatus
  readonly error?: string
}

export const listEntries = async (sessionID: string): Promise<InstructionEntry[]> => {
  const client = await getClient()
  const entries = await client.session.instructions.entry.list({ sessionID })
  return entries.map(entry => ({ key: entry.key, value: entry.value }))
}

export const findEntry = async (sessionID: string, key: string): Promise<InstructionEntry | undefined> => {
  const entries = await listEntries(sessionID)
  return entries.find(entry => entry.key === key)
}

const describeError = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

export const isEntryValueCurrent = (entry: InstructionEntry | undefined, value: string): boolean =>
  entry !== undefined && entry.value === value

export const writeEntry = async (sessionID: string, key: string, value: string): Promise<EntryResult> => {
  if (entryValueBytes(value) > MAX_ENTRY_VALUE_BYTES) {
    throw new Error(`entry ${key} exceeds ${MAX_ENTRY_VALUE_BYTES} bytes`)
  }
  try {
    const existing = await findEntry(sessionID, key)
    if (isEntryValueCurrent(existing, value)) return { status: 'unchanged' }
    const client = await getClient()
    await client.session.instructions.entry.put({ sessionID, key, value })
    return { status: 'written' }
  }
  catch (error) {
    return { status: 'failed', error: describeError(error) }
  }
}

export const removeEntry = async (sessionID: string, key: string): Promise<EntryResult> => {
  try {
    const existing = await findEntry(sessionID, key)
    if (existing === undefined) return { status: 'absent' }
    const client = await getClient()
    await client.session.instructions.entry.remove({ sessionID, key })
    return { status: 'removed' }
  }
  catch (error) {
    return { status: 'failed', error: describeError(error) }
  }
}
