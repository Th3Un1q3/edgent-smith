import { MAX_DESCRIPTION_CHARS } from './contracts'
import type { SubtaskInput, SubtaskParameters } from './contracts'

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const validateSchema = (schema: unknown): void => {
  if (schema !== undefined && !isPlainObject(schema)) {
    throw new TypeError('schema must be a JSON-serializable object')
  }
}

// A missing id is absent. A blank `task_id` is absent too, so it never resumes
// an unrelated session. A blank `fork_from` is a caller bug instead: silently
// ignoring it would run the child in a fresh session while the caller believes
// it continues one. Any other present value must be a string — a number or
// object is a caller bug, not "absent" — and a present id is trimmed so
// surrounding whitespace never reaches the SDK.
const nonBlankSessionId = (value: string, option: 'task_id' | 'fork_from'): string | undefined => {
  const trimmed = value.trim()
  if (trimmed !== '') {
    return trimmed
  }
  if (option === 'fork_from') {
    throw new TypeError('subtask fork_from must be a non-empty session id')
  }
}

const normalizeSessionId = (
  value: unknown,
  option: 'task_id' | 'fork_from',
): string | undefined => {
  if (value === undefined) {
    return
  }
  if (typeof value !== 'string') {
    throw new TypeError(`subtask ${option} must be a string`)
  }
  return nonBlankSessionId(value, option)
}

// Both fields name the source session for the turn; resuming one session while
// forking another is contradictory, so reject the pair instead of silently
// preferring task_id. The comparison runs on normalized ids, so a
// whitespace-only task_id counts as absent.
const assertSourceUnambiguous = (forkFrom: string | undefined, taskId: string | undefined): void => {
  if (forkFrom !== undefined && taskId !== undefined) {
    throw new TypeError('subtask task_id and fork_from are mutually exclusive; pass only one')
  }
}

const requirePrompt = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError('subtask prompt must be a non-empty string')
  }
  return value
}

const requireDescription = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError('subtask description must be a non-empty string')
  }
  return value.trim().slice(0, MAX_DESCRIPTION_CHARS)
}

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const normalizeTimeoutMinutes = (value: unknown): number | undefined => {
  if (value === undefined) {
    return
  }
  if (!isPositiveNumber(value)) {
    throw new TypeError('subtask timeout_minutes must be a finite number greater than 0')
  }
  return value
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(skill => typeof skill === 'string')

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== ''

const normalizeSkills = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return
  }
  if (!isStringArray(value)) {
    throw new TypeError('subtask skills must be an array of strings')
  }
  return value
}

const normalizeAgent = (value: unknown): string | undefined => {
  if (value === undefined) {
    return
  }
  if (!isNonEmptyString(value)) {
    throw new TypeError('subtask agent must be a non-empty string')
  }
  return value
}

// Internal normalized shape. `description` is required here even though the
// shared `SubtaskParameters` marks it optional for callers: normalization always
// fills it, so downstream code can drop unreachable fallbacks without widening
// the shared interface.
export interface NormalizedSubtaskParameters extends SubtaskParameters {
  description: string
}

const normalizeObjectInput = (input: Record<string, unknown>): NormalizedSubtaskParameters => {
  const prompt = requirePrompt(input.prompt)
  const description = requireDescription(input.description)
  validateSchema(input.schema)
  const forkFrom = normalizeSessionId(input.fork_from, 'fork_from')
  const taskId = normalizeSessionId(input.task_id, 'task_id')
  assertSourceUnambiguous(forkFrom, taskId)
  return {
    prompt,
    description,
    agent: normalizeAgent(input.agent),
    skills: normalizeSkills(input.skills),
    task_id: taskId,
    fork_from: forkFrom,
    timeout_minutes: normalizeTimeoutMinutes(input.timeout_minutes),
    schema: input.schema as Record<string, unknown> | undefined,
  }
}

export const normalizeParameters = (input: SubtaskInput): NormalizedSubtaskParameters => {
  if (typeof input === 'string') {
    const prompt = requirePrompt(input)
    return { prompt, description: requireDescription(prompt) }
  }
  if (!isPlainObject(input)) {
    throw new TypeError('subtask input must be a string or a parameters object')
  }
  return normalizeObjectInput(input)
}
