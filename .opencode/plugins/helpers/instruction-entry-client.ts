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

export const listEntries = async (sessionID: string): Promise<InstructionEntry[]> => {
  const client = await getClient()
  const entries = await client.session.instructions.entry.list({ sessionID })
  return entries.map(entry => ({ key: entry.key, value: entry.value }))
}

export const findEntry = async (sessionID: string, key: string): Promise<InstructionEntry | undefined> => {
  const entries = await listEntries(sessionID)
  return entries.find(entry => entry.key === key)
}

/**
Writes the entry only when the stored value differs; returns whether a write happened.
*/
export const didPutEntry = async (sessionID: string, key: string, value: string): Promise<boolean> => {
  if (entryValueBytes(value) > MAX_ENTRY_VALUE_BYTES) {
    throw new Error(`entry ${key} exceeds ${MAX_ENTRY_VALUE_BYTES} bytes`)
  }
  const existing = await findEntry(sessionID, key)
  if (existing !== undefined && existing.value === value) return false
  const client = await getClient()
  await client.session.instructions.entry.put({ sessionID, key, value })
  return true
}

export const didRemoveEntry = async (sessionID: string, key: string): Promise<boolean> => {
  const existing = await findEntry(sessionID, key)
  if (existing === undefined) return false
  const client = await getClient()
  await client.session.instructions.entry.remove({ sessionID, key })
  return true
}
