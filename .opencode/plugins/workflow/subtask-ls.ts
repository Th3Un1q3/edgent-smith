import { Effect } from 'effect'
import { MAX_DESCRIPTION_CHARS } from './contracts'
import type { LsEntry, SubtaskStatus } from './contracts'

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

const elapsedMs = (start: number, end: number | undefined): number =>
  end === undefined ? 0 : Math.max(0, end - start)

const resolveDurationMs = (
  created: number | undefined,
  updated: number | undefined,
  now: number,
  isSettled: boolean,
): number =>
  created === undefined ? 0 : elapsedMs(created, isSettled ? updated : now)

const resolveEntryStatus = (outcome: unknown): SubtaskStatus => (outcome === 'succeeded' ? 'ok' : 'error')

const parseTimeText = (value: string): number | undefined => {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

const finiteOrUndefined = (value: number): number | undefined =>
  Number.isFinite(value) ? value : undefined

const coerceDate = (value: unknown): number | undefined =>
  value instanceof Date ? finiteOrUndefined(value.getTime()) : undefined

const coerceTime = (value: unknown): number | undefined => {
  if (typeof value === 'number') return finiteOrUndefined(value)
  return typeof value === 'string' ? parseTimeText(value) : coerceDate(value)
}

const isThenable = (value: unknown): boolean =>
  typeof (value as { then?: unknown } | null)?.then === 'function'

const isEffectValue = (value: unknown): boolean =>
  typeof (value as { pipe?: unknown } | null)?.pipe === 'function'

const resolveEffectValue = async (value: unknown): Promise<unknown> => {
  if (isThenable(value)) return await (value as Promise<unknown>)
  return isEffectValue(value) ? await Effect.runPromise(value as Effect.Effect<unknown>) : value
}

const isEntryLike = (value: unknown): boolean =>
  value !== null && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string'

const toSingleEntryArray = (candidate: unknown): Array<Record<string, unknown>> =>
  isEntryLike(candidate) ? [candidate as Record<string, unknown>] : []

const dataRecords = (value: object | null): Array<Record<string, unknown>> => {
  const data = (value as { data?: unknown } | null)?.data
  return Array.isArray(data) ? (data as Array<Record<string, unknown>>) : toSingleEntryArray(data)
}

const sessionRecordsOf = (value: object | null): Array<Record<string, unknown>> => {
  const nested = dataRecords(value)
  return nested.length > 0 ? nested : toSingleEntryArray(value)
}

const toSessionArray = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>
  return typeof value === 'object' ? sessionRecordsOf(value) : []
}

const stringOrEmpty = (value: unknown): string =>
  typeof value === 'string' ? value : ''

const sessionToEntry = (session: Record<string, unknown>, now: number): LsEntry => {
  const id = stringOrEmpty(session.id)
  const rawTitle = stringOrEmpty(session.title)
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

const readSessions = async (
  reader: SessionsReader,
  method: 'list' | 'get',
  input: unknown,
): Promise<Array<Record<string, unknown>> | undefined> => {
  const read = reader[method]
  if (typeof read !== 'function') return undefined
  try {
    return toSessionArray(await resolveEffectValue(read.call(reader, input)))
  }
  catch {
    return undefined
  }
}

const listChildSessions = async (
  reader: SessionsReader,
  parentSessionID: string,
): Promise<Array<Record<string, unknown>>> => {
  const listed = await readSessions(reader, 'list', { parentID: parentSessionID })
  return listed === undefined ? (await readSessions(reader, 'get', { sessionID: parentSessionID })) ?? [] : listed
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
