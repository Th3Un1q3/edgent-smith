import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  createRunId,
  DEFAULT_PER_SUBTASK_TIMEOUT_SECONDS,
  MAX_DESCRIPTION_CHARS,
  MAX_LOGS,
  MAX_LOG_CHARS,
  MAX_MAX_SUBTASKS_CAP,
  MAX_STEP_OUTPUT_CHARS,
} from './workflow-types'
import type {
  LogFunction,
  StepRecord,
  SubtaskFunction,
  SubtaskInput,
  SubtaskParameters,
  SubtaskResult,
  SubtaskStatus,
  WorkflowContext,
  WorkflowSdkClient,
  WorkflowSessionMessage,
} from './workflow-types'

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

export const createSemaphore = (
  limit: number,
): { run: <T>(function_: () => Promise<T>) => Promise<T> } => {
  if (limit < 1) {
    throw new RangeError(`semaphore limit must be at least 1 (got ${limit})`)
  }

  let active = 0
  const queue: Array<() => void> = []

  const release = (): void => {
    active -= 1
    const next = queue.shift()
    if (next !== undefined) {
      next()
    }
  }

  const acquire = (): Promise<void> =>
    new Promise((resolve) => {
      if (active < limit) {
        active += 1
        resolve()
        return
      }
      queue.push(() => {
        active += 1
        resolve()
      })
    })

  const run = async <T>(function_: () => Promise<T>): Promise<T> => {
    await acquire()
    try {
      return await function_()
    }
    finally {
      release()
    }
  }

  return { run }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const validateSchema = (schema: unknown): void => {
  if (schema !== undefined && !isPlainObject(schema)) {
    throw new TypeError('schema must be a JSON-serializable object')
  }
}

// A missing id is absent; an empty or whitespace-only string is absent too, so a
// blank value never triggers a bogus resume/fork. Any other present value must
// be a string — a number or object is a caller bug, not "absent" — and a present
// id is trimmed so surrounding whitespace never reaches the SDK.
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
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

// Both fields name the source session for the turn; resuming one session while
// forking another is contradictory, so reject the pair instead of silently
// preferring task_id. The comparison runs on normalized ids, so whitespace-only
// values count as absent for both fields.
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

const normalizeTimeoutSeconds = (value: unknown): number | undefined => {
  if (value === undefined) {
    return
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError('subtask timeout_seconds must be a finite number greater than 0')
  }
  return value
}

const normalizeSkills = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return
  }
  if (!Array.isArray(value) || value.some(skill => typeof skill !== 'string')) {
    throw new TypeError('subtask skills must be an array of strings')
  }
  return value
}

const normalizeAgent = (value: unknown): string | undefined => {
  if (value === undefined) {
    return
  }
  if (typeof value !== 'string' || value.trim() === '') {
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
    timeout_seconds: normalizeTimeoutSeconds(input.timeout_seconds),
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

export const extractOutputText = (
  data: { parts?: Array<{ type?: string, text?: string }> } | undefined,
): string =>
  (data?.parts ?? [])
    .filter((part): part is { text: string } => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n')

const truncateOutput = (
  text: string,
  limit: number,
): { outputText: string, truncated: boolean } => {
  if (text.length <= limit) {
    return { outputText: text, truncated: false }
  }
  const removed = text.length - limit
  return { outputText: `${text.slice(0, limit)}\n…[truncated ${removed} chars]`, truncated: true }
}

export interface ParsedStructured {
  usable: boolean
  value?: unknown
}

const stripCodeFence = (text: string): string => {
  const match = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(text.trim())
  return match === null ? text.trim() : match[1].trim()
}

const hasRequiredKeys = (value: unknown, required: unknown): boolean => {
  if (!Array.isArray(required) || required.some(key => typeof key !== 'string') || required.length === 0) {
    return true
  }
  return isPlainObject(value) ? required.every(key => Object.prototype.hasOwnProperty.call(value, key)) : false
}

const RESULT_OPEN_TAG = '<result_json>'
const RESULT_CLOSE_TAG = '</result_json>'

// Scan tagged blocks from the last opening tag backwards, trying each following
// closing tag, so prose after the block is ignored and a literal close tag
// inside a JSON string is recovered by the next closing tag. First parsed value
// wins; an absent or unparseable block returns undefined.
const parseTagged = (text: string): ParsedStructured | undefined => {
  let open = text.lastIndexOf(RESULT_OPEN_TAG)
  while (open !== -1) {
    const contentStart = open + RESULT_OPEN_TAG.length
    let close = text.indexOf(RESULT_CLOSE_TAG, contentStart)
    while (close !== -1) {
      try {
        const value: unknown = JSON.parse(stripCodeFence(text.slice(contentStart, close)))
        return { usable: true, value }
      }
      catch {
        close = text.indexOf(RESULT_CLOSE_TAG, close + RESULT_CLOSE_TAG.length)
      }
    }
    // `lastIndexOf(search, -1)` clamps to 0 and returns the same tag, so an
    // opening tag at index 0 would loop forever; stop after the first one.
    open = open === 0 ? -1 : text.lastIndexOf(RESULT_OPEN_TAG, open - 1)
  }
}

// A structured turn is usable only when the text parses and, when the schema
// declares string `required` keys, every one of them is present. Tagged blocks
// are preferred; JSON without tags remains supported for backward compatibility.
export const parseStructured = (text: string, schema: Record<string, unknown>): ParsedStructured => {
  const tagged = parseTagged(text)
  if (tagged !== undefined) {
    return hasRequiredKeys(tagged.value, schema.required) ? tagged : { usable: false }
  }
  try {
    const value: unknown = JSON.parse(stripCodeFence(text))
    return hasRequiredKeys(value, schema.required) ? { usable: true, value } : { usable: false }
  }
  catch {
    return { usable: false }
  }
}

const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i

export const loadSkill = async (
  directory: string | undefined,
  name: string,
): Promise<string | undefined> => {
  if (directory === undefined || !SKILL_NAME_PATTERN.test(name)) {
    return
  }
  try {
    return await readFile(path.join(directory, '.agents', 'skills', name, 'SKILL.md'), 'utf8')
  }
  catch {
    return
  }
}

export const injectSkills = async (
  prompt: string,
  skills: string[] | undefined,
  directory?: string,
  log?: LogFunction,
): Promise<string> => {
  if (skills === undefined || skills.length === 0) {
    return prompt
  }

  const blocks: string[] = []
  for (const name of skills) {
    const content = await loadSkill(directory, name)
    if (content === undefined) {
      log?.(`skill not found: ${name}`)
      continue
    }
    blocks.push(`<skill name="${name}">\n${content}\n</skill>`)
  }

  return blocks.length === 0 ? prompt : `<task_skills>\n${blocks.join('\n')}\n</task_skills>\n\n${prompt}`
}

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

const createLogger = (logs: string[]): LogFunction => (message) => {
  pushLog(logs, message)
}

// Shared with the runner: normalize any thrown value into a stable message.
export const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error) ?? String(error)
  }
  catch {
    return String(error)
  }
}

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'

export interface ParentModel {
  providerID: string
  modelID: string
}

const extractModel = (info: WorkflowSessionMessage['info']): ParentModel | undefined => {
  if (info === undefined) {
    return
  }
  if (typeof info.providerID === 'string' && typeof info.modelID === 'string') {
    return { providerID: info.providerID, modelID: info.modelID }
  }
  const nested = info.model
  if (nested !== undefined && typeof nested.providerID === 'string' && typeof nested.modelID === 'string') {
    return { providerID: nested.providerID, modelID: nested.modelID }
  }
}

const findLatestModel = (entries: WorkflowSessionMessage[]): ParentModel | undefined => {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const model = extractModel(entries[index]?.info)
    if (model !== undefined) {
      return model
    }
  }
}

// Children must inherit the parent turn's model; native task-tool children do.
// Scans history from the end so the model of the most recent turn wins. Any
// failure degrades to the current behavior (no model) without failing the subtask.
export const resolveParentModel = async (
  client: WorkflowSdkClient,
  parentSessionID: string,
  log?: LogFunction,
): Promise<ParentModel | undefined> => {
  const warn = (message: string): void => {
    if (log !== undefined) {
      log(message)
    }
  }
  // Call the method on its receiver directly: the generated SDK methods rely on
  // `this._client`, so extracting `messages` into a bare const detaches `this`
  // and throws on every call, silently disabling model inheritance.
  if (client.session.messages === undefined) {
    warn('parent model unavailable: session.messages unsupported; continuing without model inheritance')
    return
  }
  try {
    const response = await client.session.messages({ path: { id: parentSessionID } })
    const model = findLatestModel(response?.data ?? [])
    if (model !== undefined) {
      return model
    }
    warn('parent model not found in session history; continuing without model inheritance')
    return
  }
  catch (error) {
    warn(`failed to resolve parent model: ${toErrorMessage(error)}; continuing without model inheritance`)
  }
}

const makeResult = (
  status: SubtaskStatus,
  taskID: string,
  durationMs: number,
  options: { outputText?: string, error?: string, truncated?: boolean, data?: unknown } = {},
): SubtaskResult => {
  const result: SubtaskResult = {
    outputText: options.outputText ?? '',
    task_id: taskID,
    status,
    error: options.error,
    durationMs,
    truncated: options.truncated ?? false,
  }
  return options.data === undefined ? result : { ...result, data: options.data }
}

const toStep = (description: string, result: SubtaskResult): StepRecord => ({
  description: description.slice(0, MAX_DESCRIPTION_CHARS),
  task_id: result.task_id,
  status: result.status,
  durationMs: result.durationMs,
  error: result.error,
  truncated: result.truncated,
})

export const formatElapsed = (ms: number): string => `${(Math.max(0, ms) / 1000).toFixed(1)}s`

// Live child-session titles. The marker encodes the subtask's lifecycle so the
// title itself is the status signal (the `context.metadata` transport is a
// proven dead end). `[error]` is the catch-all for a settled non-ok, non-aborted
// turn (error/empty/timeout).
const STATUS_MARKERS: Record<SubtaskStatus, string> = {
  ok: '[ok]',
  error: '[error]',
  empty: '[error]',
  timeout: '[error]',
  aborted: '[aborted]',
}

const childSessionTitle = (runId: string, marker: string, description: string): string =>
  `${runId} · ${marker} ${description.slice(0, MAX_DESCRIPTION_CHARS)}`

// Upper bound on a child-title write. `session.update` is best-effort: a slow or
// hung call must never stall the subtask past this bound — in particular it must
// never leave the subtask unguarded by its per-subtask timer and parent-abort
// link, nor orphan the child session behind a never-settling promise.
const TITLE_UPDATE_TIMEOUT_MS = 2000

// Resolve when either `promise` settles or `ms` elapses, whichever comes first.
// The timer is always cleared; a hung `promise` is abandoned, never awaited.
const settleWithin = async (promise: Promise<unknown>, ms: number): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const bound = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms)
  })
  try {
    await Promise.race([promise, bound])
  }
  finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}

// Best-effort title write through the v1 SDK (`path.id`). A missing method, a
// synchronous throw, a rejected promise, or a never-settling call must never
// fail or stall the subtask, so every failure is logged and swallowed and the
// write is bounded.
const updateChildSessionTitle = async (
  context: WorkflowContext,
  sessionID: string,
  title: string,
): Promise<void> => {
  if (sessionID === '') {
    return
  }
  const session = context.client.session
  if (session.update === undefined) {
    return
  }
  try {
    await settleWithin(
      session.update.call(session, { path: { id: sessionID }, body: { title } }),
      TITLE_UPDATE_TIMEOUT_MS,
    )
  }
  catch (error) {
    pushLog(context.logs, `failed to update child session title: ${toErrorMessage(error)}`)
  }
}

// Milestone batching: small runs report per-subtask so quick runs stay legible,
// while a large fan-out only reports every `MILESTONE_INTERVAL`-th completion so
// it cannot spam one toast per subtask. The terminal toast is always emitted by
// the runner regardless.
const MILESTONE_INTERVAL = 5
const MILESTONE_SMALL_RUN = 5

const shouldEmitMilestone = (total: number): boolean =>
  total <= MILESTONE_SMALL_RUN || total % MILESTONE_INTERVAL === 0

// One info milestone per (batched) completed subtask: `<status> <ok>/<N> ·
// <runId> · <description>`, where <status> is `ok` when the step that just
// settled succeeded and its failing status (`error`, `empty`, `timeout`,
// `aborted`) otherwise, N counts the steps recorded so far, and the description
// names that step. A missing or throwing sink is swallowed.
const emitMilestone = (context: WorkflowContext, step: StepRecord): void => {
  const notify = context.notify
  if (notify === undefined) {
    return
  }
  const total = context.steps.length
  if (!shouldEmitMilestone(total)) {
    return
  }
  const ok = context.steps.filter(entry => entry.status === 'ok').length
  const status = step.status === 'ok' ? 'ok' : step.status
  try {
    notify({
      title: 'workflow',
      message: `${status} ${ok}/${total} · ${context.runId ?? ''} · ${step.description}`,
      variant: 'info',
    })
  }
  catch (error) {
    pushLog(context.logs, `milestone notify failed: ${toErrorMessage(error)}`)
  }
}

const recordStep = (context: WorkflowContext, step: StepRecord): void => {
  // Milestone reporting lives at the single point that sees the final
  // StepRecord, so no settle path can forget it.
  if (context.steps.length < MAX_MAX_SUBTASKS_CAP) {
    context.steps.push(step)
  }
  emitMilestone(context, step)
}

// The single seconds→ms boundary: caller-facing `timeout_seconds` becomes the
// Node timer's millisecond value here; everything upstream stays in seconds.
const attemptConfig = (
  parameters: NormalizedSubtaskParameters,
): { timeoutMs: number, label: string } => ({
  timeoutMs: (parameters.timeout_seconds ?? DEFAULT_PER_SUBTASK_TIMEOUT_SECONDS) * 1000,
  label: parameters.description,
})

const buildPromptBody = (
  parameters: SubtaskParameters,
  text: string,
  defaultAgent: string,
  model?: ParentModel,
): {
  agent: string
  parts: Array<{ type: 'text', text: string }>
  model?: ParentModel
} => {
  const body: {
    agent: string
    parts: Array<{ type: 'text', text: string }>
    model?: ParentModel
  } = {
    agent: parameters.agent ?? defaultAgent,
    parts: [{ type: 'text', text }],
  }
  return model === undefined ? body : { ...body, model }
}

interface PromptResponse {
  data?: { info?: { error?: unknown }, parts?: Array<{ type?: string, text?: string }> }
}

interface TurnOutcome {
  response: PromptResponse
  parsed?: ParsedStructured
}

const SCHEMA_INSTRUCTION
  = 'Return your complete answer. You MAY include free-form prose, analysis, and code outside the tags. '
    + 'You MUST include exactly one structured block delimited by <result_json> and </result_json>. '
    + 'Between the tags put ONLY a single JSON value conforming to the JSON Schema below — '
    + 'no markdown fence, no prose, no trailing text inside the tags.'
const SCHEMA_RETRY_INSTRUCTION
  = 'Your previous reply did not contain a usable <result_json> block. '
    + 'Repeat your answer, keep any prose you still need, and end with exactly one '
    + '<result_json> ... </result_json> block containing ONLY valid JSON conforming to the JSON Schema below. '
    + 'No markdown fence inside the tags.'

const schemaBlock = (instruction: string, schema: Record<string, unknown>): string =>
  `${instruction}\n<response_schema>\n${JSON.stringify(schema)}\n</response_schema>`

const promptOnce = (
  context: WorkflowContext,
  sessionID: string,
  child: AbortController,
  parameters: SubtaskParameters,
  text: string,
  model: ParentModel | undefined,
): Promise<PromptResponse> =>
  context.client.session.prompt({
    path: { id: sessionID },
    signal: child.signal,
    body: buildPromptBody(parameters, text, context.defaultAgent, model),
  })

const shouldRetryStructured = (
  response: PromptResponse,
  parsed: ParsedStructured,
  isTimedOut: boolean,
  isParentAborted: boolean,
): boolean =>
  !isTimedOut
  && !isParentAborted
  && parsed.usable === false
  && !response.data?.info?.error
  && extractOutputText(response.data).trim() !== ''

// Runs the prompt once (or twice for an unusable structured reply) on the same
// session. The caller owns the per-attempt timer/abort, which covers both turns.
const runTurn = async (
  context: WorkflowContext,
  sessionID: string,
  child: AbortController,
  parameters: SubtaskParameters,
  basePrompt: string,
  model: ParentModel | undefined,
  isTimedOut: () => boolean,
): Promise<TurnOutcome> => {
  const { schema } = parameters
  if (schema === undefined) {
    return { response: await promptOnce(context, sessionID, child, parameters, basePrompt, model) }
  }
  const text = `${basePrompt}\n\n${schemaBlock(SCHEMA_INSTRUCTION, schema)}`
  const response = await promptOnce(context, sessionID, child, parameters, text, model)
  const parsed = parseStructured(extractOutputText(response.data), schema)
  if (!shouldRetryStructured(response, parsed, isTimedOut(), context.signal.aborted)) {
    return { response, parsed }
  }
  const retry = await promptOnce(context, sessionID, child, parameters, schemaBlock(SCHEMA_RETRY_INSTRUCTION, schema), model)
  return { response: retry, parsed: parseStructured(extractOutputText(retry.data), schema) }
}

interface ResolvedSession {
  sessionID: string
  forkedFrom?: string
}

// `client.session.fork` must be invoked on its receiver: the generated SDK
// method relies on `this`, so extracting it into a bare const detaches the
// receiver and throws. The unsupported check narrows the optional method.
//
// The call argument is exactly `{ path: { id: sourceID } }`. The SDK's
// `SessionForkData.body.messageID` is optional; with no message id the server
// forks at the session's latest message, which is the "continue this
// conversation" semantics a subtask wants, and the caller only ever has a
// session id. This exact argument object is pinned by the fork test.
const callFork = async (
  client: WorkflowSdkClient,
  sourceID: string,
): Promise<{ data?: { id?: string } }> => {
  if (client.session.fork === undefined) {
    throw new Error(`failed to fork subtask session ${sourceID}: session.fork is unsupported`)
  }
  try {
    return await client.session.fork({ path: { id: sourceID } })
  }
  catch (error) {
    throw new Error(`failed to fork subtask session ${sourceID}: ${toErrorMessage(error)}`)
  }
}

const forkSession = async (client: WorkflowSdkClient, sourceID: string): Promise<string> => {
  const forked = await callFork(client, sourceID)
  const forkedID = forked.data?.id
  if (typeof forkedID !== 'string' || forkedID === '') {
    throw new Error(`failed to fork subtask session ${sourceID}: no session id returned`)
  }
  return forkedID
}

// The only deliberate title path is `updateChildSessionTitle`: the child moves to
// `[running] <description>` before the first prompt and to its terminal marker
// afterwards. `session.create` must still pass a title (the SDK requires one),
// but it is only the initial seed for a brand-new session. A forked session gets
// no seed at all and is moved to `[running]` immediately, so it never surfaces
// the source session's title.
const resolveSessionID = async (
  client: WorkflowSdkClient,
  parameters: NormalizedSubtaskParameters,
  parentSessionID: string,
): Promise<ResolvedSession> => {
  if (parameters.task_id !== undefined) {
    return { sessionID: parameters.task_id }
  }
  if (parameters.fork_from !== undefined) {
    return { sessionID: await forkSession(client, parameters.fork_from), forkedFrom: parameters.fork_from }
  }
  const created = await client.session.create({
    body: { title: parameters.description, parentID: parentSessionID },
  })
  return { sessionID: created.data?.id ?? '' }
}

interface ClassificationContext {
  timedOut: boolean
  parentAborted: boolean
  timeoutMs: number
  parsed: ParsedStructured | undefined
}

const turnError = (response: PromptResponse): unknown => response.data?.info?.error

const classifyResponse = (
  response: PromptResponse,
  sessionID: string,
  startedAt: number,
  context: ClassificationContext,
): SubtaskResult => {
  const durationMs = Date.now() - startedAt

  // A timed-out turn may come back as a resolved empty response, so timeout
  // takes precedence over abort and any info.error carried by the response.
  if (context.timedOut) {
    return makeResult('timeout', sessionID, durationMs, {
      error: `subtask timed out after ${formatElapsed(context.timeoutMs)}`,
    })
  }
  if (context.parentAborted) {
    return makeResult('aborted', sessionID, durationMs, { error: 'subtask aborted' })
  }

  const errorInfo = turnError(response)
  if (errorInfo) {
    return makeResult('error', sessionID, durationMs, { error: toErrorMessage(errorInfo) })
  }
  const { outputText, truncated } = truncateOutput(extractOutputText(response.data), MAX_STEP_OUTPUT_CHARS)
  if (outputText.trim() === '') {
    return makeResult('empty', sessionID, durationMs, {
      outputText,
      truncated,
      error: 'subtask produced no output',
    })
  }
  const parsedState = context.parsed
  if (parsedState !== undefined && !parsedState.usable) {
    return makeResult('error', sessionID, durationMs, {
      outputText,
      truncated,
      error: 'subtask did not return valid JSON matching the schema',
    })
  }
  const data = parsedState === undefined ? undefined : parsedState.value
  return makeResult('ok', sessionID, durationMs, { outputText, truncated, data })
}

interface ErrorContext {
  child: AbortController
  parentAborted: boolean
  timeoutMs: number
  timedOut: boolean
  sessionID: string
  forkedFrom?: string
  startedAt: number
}

const classifyError = (error: unknown, context: ErrorContext): SubtaskResult => {
  const durationMs = Date.now() - context.startedAt
  let result: SubtaskResult
  if (isAbortError(error) || context.child.signal.aborted || context.parentAborted) {
    const status: SubtaskStatus = context.timedOut ? 'timeout' : 'aborted'
    const message = context.timedOut
      ? `subtask timed out after ${formatElapsed(context.timeoutMs)}`
      : 'subtask aborted'
    result = makeResult(status, context.sessionID, durationMs, { error: message })
  }
  else {
    result = makeResult('error', context.sessionID, durationMs, { error: toErrorMessage(error) })
  }
  // A fork that succeeded before a later phase failed still created a session,
  // so its provenance survives the error classification.
  return context.forkedFrom === undefined ? result : { ...result, forked_from: context.forkedFrom }
}

// Best-effort server-side abort: a rejecting abort promise must never surface
// as an unhandled rejection, and a synchronous throw must not escape the handler.
const abortSessionSilently = async (client: WorkflowSdkClient, sessionID: string): Promise<void> => {
  try {
    await client.session.abort?.({ path: { id: sessionID } })
  }
  catch {
    // ignore: abort is best-effort cleanup
  }
}

export const linkParentAbort = (
  signal: AbortSignal,
  child: AbortController,
  abortSession?: () => void,
): (() => void) => {
  const onAbort = (): void => {
    child.abort()
    abortSession?.()
  }
  signal.addEventListener('abort', onAbort, { once: true })
  if (signal.aborted) {
    onAbort()
  }
  return onAbort
}

const finalizeAttempt = (
  context: WorkflowContext,
  child: AbortController,
  onParentAbort: (() => void) | undefined,
  timer: ReturnType<typeof setTimeout> | undefined,
  running: Map<AbortController, string>,
): void => {
  if (timer !== undefined) {
    clearTimeout(timer)
  }
  if (onParentAbort !== undefined) {
    context.signal.removeEventListener('abort', onParentAbort)
  }
  context.active.delete(child)
  // Retire the in-flight registration; the live signal now rides the child
  // session title, not the (dead) `context.metadata` running event.
  running.delete(child)
}

const hasSkills = (skills: string[] | undefined): boolean =>
  skills !== undefined && skills.length > 0

export const createSubtask = (context: WorkflowContext): SubtaskFunction => {
  const semaphore = createSemaphore(Math.max(1, context.maxConcurrent))
  // Backfill the in-flight registry so a directly constructed context still
  // reports running membership; `createContext` normally initializes it.
  // Captured as a local so the closure holds a non-optional map.
  const running = (context.running ??= new Map<AbortController, string>())
  context.startedAt ??= Date.now()
  // Backfill the run id so a directly constructed context still produces
  // run-tagged titles and milestones; the runner normally generates it once per
  // run and threads it through. Captured as a local for the non-optional type.
  const runId = (context.runId ??= createRunId())

  // Memoized so a workflow run probes the parent history at most once, even
  // when many subtasks resolve their model concurrently.
  let parentModel: Promise<ParentModel | undefined> | undefined
  const resolveModelOnce = (): Promise<ParentModel | undefined> => {
    parentModel ??= resolveParentModel(context.client, context.parentSessionID, createLogger(context.logs))
    return parentModel
  }

  return async (input: SubtaskInput): Promise<SubtaskResult> => {
    if (context.budget.used >= context.maxSubtasks) {
      throw new BudgetExceededError(`workflow subtask budget exceeded (${context.maxSubtasks})`)
    }
    context.budget.used += 1

    if (context.signal.aborted) {
      const result = makeResult('aborted', '', 0, { error: 'workflow already aborted' })
      recordStep(context, toStep('aborted', result))
      return result
    }

    let parameters: NormalizedSubtaskParameters
    try {
      parameters = normalizeParameters(input)
    }
    catch (error) {
      const result = makeResult('error', '', 0, { error: toErrorMessage(error) })
      recordStep(context, toStep('invalid subtask input', result))
      return result
    }

    return semaphore.run(async (): Promise<SubtaskResult> => {
      const startedAt = Date.now()
      const { timeoutMs, label } = attemptConfig(parameters)
      const child = new AbortController()
      // Register before session creation so the runner's timeout grace sees an
      // in-flight subtask even while `session.create` is still pending; otherwise
      // the grace is skipped and the step is dropped. Always removed in `finally`.
      context.active.add(child)
      running.set(child, label)
      let sessionID = ''
      let resolved: ResolvedSession | undefined
      let isTimedOut = false
      let timer: ReturnType<typeof setTimeout> | undefined
      let onParentAbort: (() => void) | undefined

      try {
        resolved = await resolveSessionID(context.client, parameters, context.parentSessionID)
        sessionID = resolved.sessionID
        if (sessionID === '') {
          const result = makeResult('error', '', Date.now() - startedAt, {
            error: 'failed to create subtask session',
          })
          recordStep(context, toStep(label, result))
          return result
        }
        const forkedFrom = resolved.forkedFrom

        // Mark the child running before the prompt so the live title moves even
        // while the turn is in flight.
        await updateChildSessionTitle(
          context,
          sessionID,
          childSessionTitle(runId, '[running]', label),
        )

        const finalPrompt = hasSkills(parameters.skills)
          ? await injectSkills(parameters.prompt, parameters.skills, context.directory, createLogger(context.logs))
          : parameters.prompt

        let isSessionAborted = false
        const abortChildSession = (): void => {
          if (isSessionAborted) {
            return
          }
          isSessionAborted = true
          void abortSessionSilently(context.client, sessionID)
        }

        onParentAbort = linkParentAbort(context.signal, child, abortChildSession)

        timer = setTimeout(() => {
          isTimedOut = true
          child.abort()
          abortChildSession()
        }, timeoutMs)

        const model = await resolveModelOnce()
        const turn = await runTurn(context, sessionID, child, parameters, finalPrompt, model, () => isTimedOut)

        // Clear before classifying so a timer that fires after the turn already
        // completed cannot retroactively flip a success into a timeout.
        if (timer !== undefined) {
          clearTimeout(timer)
          timer = undefined
        }

        const classified = classifyResponse(turn.response, sessionID, startedAt, {
          timedOut: isTimedOut,
          parentAborted: context.signal.aborted,
          timeoutMs,
          parsed: turn.parsed,
        })
        // Provenance only for a session actually forked on this attempt.
        const result = forkedFrom === undefined ? classified : { ...classified, forked_from: forkedFrom }
        recordStep(context, toStep(label, result))
        await updateChildSessionTitle(
          context,
          sessionID,
          childSessionTitle(runId, STATUS_MARKERS[result.status], label),
        )
        return result
      }
      catch (error) {
        if (error instanceof BudgetExceededError) {
          throw error
        }
        const result = classifyError(error, {
          child,
          parentAborted: context.signal.aborted,
          timeoutMs,
          timedOut: isTimedOut,
          sessionID,
          // Only a fork that already returned an id reaches the catch with
          // `forkedFrom` set; a failed fork leaves it undefined.
          forkedFrom: resolved?.forkedFrom,
          startedAt,
        })
        recordStep(context, toStep(label, result))
        await updateChildSessionTitle(
          context,
          sessionID,
          childSessionTitle(runId, STATUS_MARKERS[result.status], label),
        )
        return result
      }
      finally {
        finalizeAttempt(context, child, onParentAbort, timer, running)
      }
    })
  }
}
