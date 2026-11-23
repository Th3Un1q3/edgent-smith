import { entryValueBytes, isRecord, isValueObject } from '../helpers/instructions/entry-client'
import type { CarrierStorage, LedgerEntry } from './carrier-contract'
import { warnOnce } from './carrier-warnings'

const MAX_LEDGER_ENTRIES = 16
const MAX_LEDGER_BYTES = 96 * 1024

const ledgerKey = (sessionID: string): string => `instruction-carrier/${sessionID}.unpublished`

const memoryState = new Map<string, unknown>()

export const MEMORY_STORAGE: CarrierStorage = {
  get: key => memoryState.get(key),
  set: (key, value) => { memoryState.set(key, value) },
  remove: (key) => { memoryState.delete(key) },
}

const LEDGER_TEXT_FIELDS = ['identity', 'key'] as const

const isLedgerEntry = (entry: unknown): entry is LedgerEntry =>
  isRecord(entry)
  && LEDGER_TEXT_FIELDS.every(field => typeof entry[field] === 'string')
  && isValueObject(entry.value)

export const readLedger = async (storage: CarrierStorage, sessionID: string): Promise<LedgerEntry[]> => {
  const stored = await storage.get(ledgerKey(sessionID))
  if (!isRecord(stored)) return []
  const entries = stored.entries
  return Array.isArray(entries) ? entries.filter(isLedgerEntry) : []
}

export const commitLedger = async (
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

const trimLedger = (entries: LedgerEntry[]): void => {
  while (entries.length > MAX_LEDGER_ENTRIES || entryValueBytes(entries) > MAX_LEDGER_BYTES) entries.shift()
}

export const capLedger = async (
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
    trimLedger(capped)
  }
  return capped
}

export const mergeLedger = (
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
