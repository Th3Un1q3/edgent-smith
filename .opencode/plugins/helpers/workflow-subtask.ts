import path from 'node:path'

import { getClient } from './service-client'
import {
  DEFAULT_PER_SUBTASK_TIMEOUT_MINUTES,
  MAX_DESCRIPTION_CHARS,
  MAX_LOGS,
  MAX_LOG_CHARS,
  MAX_MAX_SUBTASKS_CAP,
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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
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
  if (trimmed === '') {
    if (option === 'fork_from') {
      throw new TypeError('subtask fork_from must be a non-empty session id')
    }
    return
  }
  return trimmed
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

const normalizeTimeoutMinutes = (value: unknown): number | undefined => {
  if (value === undefined) {
    return
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError('subtask timeout_minutes must be a finite number greater than 0')
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
interface NormalizedSubtaskParameters extends SubtaskParameters {
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

export const extractOutputText = (
  data: { parts?: Array<{ type?: string, text?: string }> } | undefined,
): string =>
  (data?.parts ?? [])
    .filter((part): part is { text: string } => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n')

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

// Structural shape of the native `Skill.Info` record, so both the plugin skill
// domain and the server client satisfy it without importing the schema package.
export interface SkillRecord {
  readonly name: string
  readonly description?: string
  readonly path?: string
  readonly content: string
}

export type SkillLister = (directory?: string) => Promise<readonly SkillRecord[]>

// The native skill list is the only source of injected content: nothing on this
// path reads a SKILL.md from disk.
const listNativeSkills: SkillLister = async (directory) => {
  const client = await getClient(undefined, directory)
  const response = await client.skill.list(directory === undefined ? undefined : { location: { directory } })
  return response.data
}

const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

// Only a leading YAML block is removed, so a `---` later in the body (a rule or
// a fence) survives untouched.
export const stripFrontmatter = (content: string): string => {
  const match = FRONTMATTER_PATTERN.exec(content)
  return match === null ? content : content.slice(match[0].length)
}

const FOLDED_SCALAR = /^[>|][+-]?$/

const unquote = (value: string): string => {
  const quoted = /^(['"])([\s\S]*)\1$/.exec(value)
  return quoted === null ? value : quoted[2]
}

const foldedLines = (lines: string[], start: number): string[] => {
  const value: string[] = []
  for (const line of lines.slice(start)) {
    if (line.trim() === '') {
      continue
    }
    if (!/^\s/.test(line)) {
      break
    }
    value.push(line.trim())
  }
  return value
}

const canonicalScalar = (inline: string, lines: string[], index: number): string | undefined => {
  if (inline !== '' && !FOLDED_SCALAR.test(inline)) {
    return unquote(inline) || undefined
  }
  const value = foldedLines(lines, index + 1).join(' ')
  return value === '' ? undefined : value
}

// Fallback only: a description on the native record always wins.
export const frontmatterDescription = (content: string): string | undefined => {
  const block = FRONTMATTER_PATTERN.exec(content)
  if (block === null) {
    return
  }
  const lines = block[1].split(/\r?\n/)
  const index = lines.findIndex(line => /^description\s*:/.test(line))
  return index === -1 ? undefined : canonicalScalar(lines[index].replace(/^description\s*:\s*/, '').trim(), lines, index)
}

const collapse = (value: string): string => value.replaceAll(/\s+/g, ' ').trim()

const skillDescription = (record: SkillRecord): string | undefined => {
  const declared = record.description === undefined ? undefined : collapse(record.description)
  if (declared !== undefined && declared !== '') {
    return declared
  }
  const fallback = frontmatterDescription(record.content)
  return fallback === undefined ? undefined : collapse(fallback)
}

const isInside = (relative: string): boolean =>
  relative !== ''
  && relative !== '..'
  && !relative.startsWith(`..${path.sep}`)
  && !path.isAbsolute(relative)

// A path outside the session directory is omitted rather than emitted absolute.
const relativeSkillPath = (
  skillPath: string | undefined,
  directory: string | undefined,
): string | undefined => {
  if (skillPath === undefined || directory === undefined || !path.isAbsolute(skillPath) || !path.isAbsolute(directory)) {
    return
  }
  const relative = path.relative(directory, skillPath)
  return isInside(relative) ? relative.split(path.sep).join('/') : undefined
}

const formatSkillBlock = (name: string, record: SkillRecord, directory?: string): string => {
  const lines = [`<skill name="${name}">`]
  const description = skillDescription(record)
  if (description !== undefined) {
    lines.push(`description: ${description}`)
  }
  const relative = relativeSkillPath(record.path, directory)
  if (relative !== undefined) {
    lines.push(`path: ${relative}`)
  }
  lines.push(stripFrontmatter(record.content).trimEnd(), '</skill>')
  return lines.join('\n')
}

export interface SkillInjectionOptions {
  directory?: string
  list?: SkillLister | undefined
  log?: LogFunction
}

const listSkillRecords = async (
  options: SkillInjectionOptions,
): Promise<readonly SkillRecord[] | undefined> => {
  try {
    return await (options.list ?? listNativeSkills)(options.directory)
  }
  catch (error) {
    options.log?.(`skill list failed: ${toErrorMessage(error)}`)
  }
}

const buildSkillBlocks = (
  skills: string[],
  records: readonly SkillRecord[],
  directory?: string,
  log?: LogFunction,
): string[] => {
  const byName = new Map(records.map(record => [record.name, record]))
  const blocks: string[] = []
  for (const name of skills) {
    const record = SKILL_NAME_PATTERN.test(name) ? byName.get(name) : undefined
    if (record === undefined) {
      log?.(`skill not found: ${name}`)
      continue
    }
    blocks.push(formatSkillBlock(name, record, directory))
  }
  return blocks
}

export const injectSkills = async (
  prompt: string,
  skills: string[] | undefined,
  options: SkillInjectionOptions = {},
): Promise<string> => {
  if (skills === undefined || skills.length === 0) {
    return prompt
  }

  const records = await listSkillRecords(options)
  if (records === undefined) {
    return prompt
  }

  const blocks = buildSkillBlocks(skills, records, options.directory, options.log)
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
  // TODO: DEFERRED (owned by the adapter messages/parent-model inheritance follow-up ADR) rewrite the parent-model read in `resolveParentModel` below, from its `session.messages` check to the end of the function, to use the adapter's V2-native message shape instead of the V1 `info.providerID`/`info.modelID` shim; deferred because it changes `WorkflowSdkClient`, the adapter, and the engine, which needs that separate ADR.
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
  options: { outputText?: string, error?: string, data?: unknown } = {},
): SubtaskResult => {
  const result: SubtaskResult = {
    outputText: options.outputText ?? '',
    task_id: taskID,
    status,
    error: options.error,
    durationMs,
  }
  return options.data === undefined ? result : { ...result, data: options.data }
}

const toStep = (description: string, result: SubtaskResult): StepRecord => ({
  description: description.slice(0, MAX_DESCRIPTION_CHARS),
  task_id: result.task_id,
  status: result.status,
  durationMs: result.durationMs,
  error: result.error,
})

// The subtask timeout error names the configured limit, not the elapsed wall
// time, so it reads in the unit the caller sets: minutes. A fractional minute
// value passes through verbatim, so the reported limit always matches the input.
export const formatTimeoutMinutes = (minutes: number): string =>
  `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`

const recordStep = (context: WorkflowContext, step: StepRecord): void => {
  if (context.steps.length < MAX_MAX_SUBTASKS_CAP) {
    context.steps.push(step)
  }
}

// The single minutes→ms boundary for subtasks: caller-facing `timeout_minutes`
// becomes the Node timer's millisecond value here; everything upstream stays in
// minutes, and the runner keeps millisecond semantics internally.
const attemptConfig = (
  parameters: NormalizedSubtaskParameters,
): { timeoutMs: number, timeoutMinutes: number, label: string } => {
  const timeoutMinutes = parameters.timeout_minutes ?? DEFAULT_PER_SUBTASK_TIMEOUT_MINUTES
  return { timeoutMs: timeoutMinutes * 60_000, timeoutMinutes, label: parameters.description }
}

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
// The call argument is exactly `{ sessionID: sourceID }`, the v2
// `SessionForkInput` from `@opencode/client` (`{ sessionID, before? }`) minus
// the optional boundary. With no `before` the server forks at the session's
// latest message, which is the "continue this conversation" semantics a subtask
// wants, and the caller only ever has a session id. This exact argument object
// is pinned by the fork tests.
const callFork = async (
  client: WorkflowSdkClient,
  sourceID: string,
): Promise<{ data?: { id?: string } }> => {
  if (client.session.fork === undefined) {
    throw new Error(`failed to fork subtask session ${sourceID}: session.fork is unsupported`)
  }
  try {
    return await client.session.fork({ sessionID: sourceID })
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

// `session.create` requires a title, so the description seeds a brand-new
// session. A forked session gets no seed, so it never surfaces the source
// session's title.
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
  timeoutMinutes: number
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
      error: `subtask timed out after ${formatTimeoutMinutes(context.timeoutMinutes)}`,
    })
  }
  if (context.parentAborted) {
    return makeResult('aborted', sessionID, durationMs, { error: 'subtask aborted' })
  }

  const errorInfo = turnError(response)
  if (errorInfo) {
    return makeResult('error', sessionID, durationMs, { error: toErrorMessage(errorInfo) })
  }
  const outputText = extractOutputText(response.data)
  if (outputText.trim() === '') {
    return makeResult('empty', sessionID, durationMs, {
      outputText,
      error: 'subtask produced no output',
    })
  }
  const parsedState = context.parsed
  if (parsedState !== undefined && !parsedState.usable) {
    return makeResult('error', sessionID, durationMs, {
      outputText,
      error: 'subtask did not return valid JSON matching the schema',
    })
  }
  const data = parsedState === undefined ? undefined : parsedState.value
  return makeResult('ok', sessionID, durationMs, { outputText, data })
}

interface ErrorContext {
  child: AbortController
  parentAborted: boolean
  timeoutMinutes: number
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
      ? `subtask timed out after ${formatTimeoutMinutes(context.timeoutMinutes)}`
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
): void => {
  if (timer !== undefined) {
    clearTimeout(timer)
  }
  if (onParentAbort !== undefined) {
    context.signal.removeEventListener('abort', onParentAbort)
  }
  context.active.delete(child)
}

const hasSkills = (skills: string[] | undefined): boolean =>
  skills !== undefined && skills.length > 0

// The plugin entry point hands the native skill domain down; a context without
// it (tests, other callers) falls back to the server's own skill list.
export interface SkillAwareContext extends WorkflowContext {
  skill?: SkillLister
}

const runAttempt = async (
  context: SkillAwareContext,
  parameters: NormalizedSubtaskParameters,
  resolveModelOnce: () => Promise<ParentModel | undefined>,
): Promise<SubtaskResult> => {
  const startedAt = Date.now()
  const { timeoutMs, timeoutMinutes, label } = attemptConfig(parameters)
  const child = new AbortController()
  // Register before session creation so the runner's timeout grace sees an
  // in-flight subtask even while `session.create` is still pending; otherwise
  // the grace is skipped and the step is dropped. Always removed in `finally`.
  context.active.add(child)
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

    const finalPrompt = hasSkills(parameters.skills)
      ? await injectSkills(parameters.prompt, parameters.skills, {
          directory: context.directory,
          list: context.skill,
          log: createLogger(context.logs),
        })
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
      timeoutMinutes,
      parsed: turn.parsed,
    })
    // Provenance only for a session actually forked on this attempt.
    const result = forkedFrom === undefined ? classified : { ...classified, forked_from: forkedFrom }
    recordStep(context, toStep(label, result))
    return result
  }
  catch (error) {
    if (error instanceof BudgetExceededError) {
      throw error
    }
    const result = classifyError(error, {
      child,
      parentAborted: context.signal.aborted,
      timeoutMinutes,
      timedOut: isTimedOut,
      sessionID,
      // Only a fork that already returned an id reaches the catch with
      // `forkedFrom` set; a failed fork leaves it undefined.
      forkedFrom: resolved?.forkedFrom,
      startedAt,
    })
    recordStep(context, toStep(label, result))
    return result
  }
  finally {
    finalizeAttempt(context, child, onParentAbort, timer)
  }
}

export const createSubtask = (context: SkillAwareContext): SubtaskFunction => {
  context.startedAt ??= Date.now()

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

    return runAttempt(context, parameters, resolveModelOnce)
  }
}
