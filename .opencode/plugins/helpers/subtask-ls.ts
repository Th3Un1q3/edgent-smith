import { Effect } from 'effect'
import { MAX_DESCRIPTION_CHARS } from './workflow-types'
import type { LsEntry, SubtaskStatus } from './workflow-types'

const DEFAULT_LS_COUNT = 10
const MAX_LS_COUNT = 50

interface ListStepsOptions {
  count?: number
  status?: SubtaskStatus
}

export interface SessionsReader {
  list?: (input?: unknown) => unknown
  get?: (input?: unknown) => unknown
}

export const clampCount = (value: number | undefined, max: number, fallback: number): number => {
  return Number.isFinite(value) ? Math.min(Math.max(Math.floor(value as number), 1), max) : fallback
}

const resolveCount = (count: number | undefined): number => clampCount(count, MAX_LS_COUNT, DEFAULT_LS_COUNT)

const truncateDescription = (description: string): string =>
  description.length > MAX_DESCRIPTION_CHARS ? description.slice(0, MAX_DESCRIPTION_CHARS) : description

const stripStatusMarker = (title: string): string =>
  title.replace(/^\[(ok|error)\]\s*/i, '')

const SETTLED_OUTCOMES: ReadonlySet<string> = new Set(['succeeded', 'failed', 'interrupted'])

const isSettledOutcome = (outcome: unknown): boolean =>
  typeof outcome === 'string' && SETTLED_OUTCOMES.has(outcome)

const resolveDurationMs = (
  created: number | undefined,
  updated: number | undefined,
  now: number,
  isSettled: boolean,
): number => {
  if (isSettled) {
    return created !== undefined && updated !== undefined ? Math.max(0, updated - created) : 0
  }
  return created === undefined ? 0 : Math.max(0, now - created)
}

const resolveEntryStatus = (outcome: unknown): SubtaskStatus => (outcome === 'succeeded' ? 'ok' : 'error')

const coerceTime = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isNaN(time) ? undefined : time
  }
  return undefined
}

const resolveEffectValue = async (value: unknown): Promise<unknown> => {
  if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
    if (typeof (value as { then?: unknown }).then === 'function') return await (value as Promise<unknown>)
    if (typeof (value as { pipe?: unknown }).pipe === 'function') return await Effect.runPromise(value as Effect.Effect<unknown>)
  }
  return value
}

const toSingleEntryArray = (candidate: unknown): Array<Record<string, unknown>> => {
  return candidate !== null && typeof candidate === 'object' && typeof (candidate as { id?: unknown }).id === 'string' ? [candidate as Record<string, unknown>] : []
}

const toSessionArray = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>
  if (value === null || typeof value !== 'object') return []
  const data = (value as { data?: unknown }).data
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>
  const nested = toSingleEntryArray(data)
  return nested.length > 0 ? nested : toSingleEntryArray(value)
}

const sessionToEntry = (session: Record<string, unknown>, now: number): LsEntry => {
  const id = typeof session.id === 'string' ? session.id : ''
  const rawTitle = typeof session.title === 'string' ? session.title : ''
  const time = (session.time ?? {}) as { created?: unknown, updated?: unknown }
  const created = coerceTime(time.created)
  const updated = coerceTime(time.updated)
  const outcome = session.outcome
  const isSettled = isSettledOutcome(outcome)
  return {
    description: truncateDescription(stripStatusMarker(rawTitle)),
    durationMs: resolveDurationMs(created, updated, now, isSettled),
    task_id: id,
    status: resolveEntryStatus(outcome),
  }
}

const listChildSessions = async (
  reader: SessionsReader,
  parentSessionID: string,
): Promise<Array<Record<string, unknown>>> => {
  let sessions: Array<Record<string, unknown>> | undefined
  if (typeof reader.list === 'function') {
    try {
      const listed = await resolveEffectValue(reader.list({ parentID: parentSessionID }))
      sessions = toSessionArray(listed)
    }
    catch {
      sessions = undefined
    }
  }
  if (sessions === undefined) {
    if (typeof reader.get !== 'function') return []
    const fetched = await resolveEffectValue(reader.get({ sessionID: parentSessionID }))
    sessions = toSessionArray(fetched)
  }
  return sessions
}

export const listSubtasksFromSessions = async (
  reader: SessionsReader,
  parentSessionID: string,
  options: ListStepsOptions,
): Promise<LsEntry[]> => {
  const wanted = resolveCount(options.count)
  const now = Date.now()
  const children = await listChildSessions(reader, parentSessionID)
  const entries = children.map(session => sessionToEntry(session, now))
  const filtered = options.status === undefined ? entries : entries.filter(entry => entry.status === options.status)
  return filtered.slice(0, wanted)
}
