import { MAX_LOGS, MAX_LOG_CHARS } from './contracts'
import type { LogFunction } from './contracts'

// Shared with the runner so both log paths JSON-stringify with a String fallback
// and mark over-length entries identically.
export const stringifyLogMessage = (message: unknown): string => {
  try {
    return JSON.stringify(message) ?? String(message)
  }
  catch {
    return String(message)
  }
}

const LOG_TRUNCATION_MARKER = '…[truncated]'

export const pushLog = (logs: string[], message: unknown): void => {
  if (logs.length >= MAX_LOGS) {
    return
  }
  const text = stringifyLogMessage(message)
  logs.push(
    text.length > MAX_LOG_CHARS ? `${text.slice(0, MAX_LOG_CHARS)}${LOG_TRUNCATION_MARKER}` : text,
  )
}

export const createLogger = (logs: string[]): LogFunction => (message) => {
  pushLog(logs, message)
}

// Shared with the runner: normalize any thrown value into a stable message.
export const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : stringifyLogMessage(error)
}
