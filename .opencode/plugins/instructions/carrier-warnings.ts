import type { CarrierStorage } from './carrier-contract'

const warningKey = (sessionID: string): string => `instruction-carrier/${sessionID}`

export const warn = (message: string): void => {
  process.emitWarning(`[instructions-loader] ${message}`)
}

const isWarnedRecord = (value: unknown): value is { reasons?: unknown } =>
  typeof value === 'object' && value !== null

const readWarnedReasons = async (storage: CarrierStorage, sessionID: string): Promise<string[]> => {
  const stored = await storage.get(warningKey(sessionID))
  if (!isWarnedRecord(stored)) return []
  const reasons = stored.reasons
  return Array.isArray(reasons)
    ? reasons.filter((reason): reason is string => typeof reason === 'string')
    : []
}

export const warnOnce = async (
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
