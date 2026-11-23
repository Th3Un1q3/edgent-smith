import { clampCount } from './subtask-ls'
import type { SubtaskResult, SubtaskStatus } from './contracts'

export const DEFAULT_TAIL_COUNT = 3
export const MAX_TAIL_COUNT = 5
export const TAIL_TTL_MS = 24 * 60 * 60 * 1000
export const MAX_TAIL_TASK_IDS = 1000

export interface TailEntry {
  task_id: string
  outputText: string
  status: SubtaskStatus
  updated_at: number
}

export interface TailOptions {
  count?: number
}

const store = new Map<string, TailEntry[]>()

const isExpired = (entry: TailEntry, now: number): boolean => now - entry.updated_at > TAIL_TTL_MS

const evictOldest = (entries: Map<string, TailEntry[]>, limit: number): void => {
  while (entries.size > limit) {
    const oldest = entries.keys().next()
    if (oldest.done) break
    entries.delete(oldest.value)
  }
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value !== ''

export const recordTailOutput = (result: SubtaskResult): void => {
  if (!isNonEmptyString(result.task_id)) return
  const now = Date.now()
  const entry: TailEntry = {
    task_id: result.task_id,
    outputText: result.outputText,
    status: result.status,
    updated_at: now,
  }
  const existing = store.get(result.task_id) ?? []
  const live = existing.filter(stored => !isExpired(stored, now))
  live.push(entry)
  store.delete(result.task_id)
  store.set(result.task_id, live.slice(-MAX_TAIL_COUNT))
  evictOldest(store, MAX_TAIL_TASK_IDS)
}

const pruneExpired = (task_id: string, entries: TailEntry[], live: TailEntry[]): void => {
  if (live.length === entries.length) return
  if (live.length === 0) store.delete(task_id)
  else store.set(task_id, live)
}

export const readTailOutputs = (task_id: string): TailEntry[] => {
  const now = Date.now()
  const entries = store.get(task_id)
  if (entries === undefined) return []
  const live = entries.filter(entry => !isExpired(entry, now))
  pruneExpired(task_id, entries, live)
  return [...live]
}

export const tailOutputs = (task_id: string, options: TailOptions): TailEntry[] => {
  const wanted = clampCount(options.count, MAX_TAIL_COUNT, DEFAULT_TAIL_COUNT)
  return readTailOutputs(task_id).slice(-wanted)
}
