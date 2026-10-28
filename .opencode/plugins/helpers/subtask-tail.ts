import { clampCount } from './subtask-ls'
import type { SubtaskResult, SubtaskStatus } from './workflow-types'

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

export const recordTailOutput = (result: SubtaskResult): void => {
  if (typeof result.task_id !== 'string' || result.task_id === '') return
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
  while (store.size > MAX_TAIL_TASK_IDS) {
    const oldest = store.keys().next()
    if (oldest.done) break
    store.delete(oldest.value)
  }
}

export const readTailOutputs = (task_id: string): TailEntry[] => {
  const now = Date.now()
  const entries = store.get(task_id)
  if (entries === undefined) return []
  const live = entries.filter(entry => !isExpired(entry, now))
  if (live.length !== entries.length) {
    if (live.length === 0) store.delete(task_id)
    else store.set(task_id, live)
  }
  return [...live]
}

export const tailOutputs = (task_id: string, options: TailOptions): TailEntry[] => {
  const wanted = clampCount(options.count, MAX_TAIL_COUNT, DEFAULT_TAIL_COUNT)
  return readTailOutputs(task_id).slice(-wanted)
}
