import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  DEFAULT_PER_SUBTASK_TIMEOUT_MS,
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

export const normalizeParameters = (input: SubtaskInput): SubtaskParameters => {
  if (typeof input === 'string') {
    if (input.length === 0) {
      throw new TypeError('subtask prompt must be a non-empty string')
    }
    return { prompt: input, description: input.slice(0, MAX_DESCRIPTION_CHARS) }
  }
  if (!isPlainObject(input)) {
    throw new TypeError('subtask input must be a string or a parameters object')
  }
  const prompt = input.prompt
  if (typeof prompt !== 'string' || prompt.length === 0) {
    throw new TypeError('subtask prompt must be a non-empty string')
  }
  const description = input.description
  if (typeof description !== 'string' || description.trim().length === 0) {
    throw new TypeError('subtask description must be a non-empty string')
  }
  const { schema } = input
  validateSchema(schema)
  const parameters = input as SubtaskParameters
  return {
    prompt,
    description: description.slice(0, MAX_DESCRIPTION_CHARS),
    agent: parameters.agent,
    skills: parameters.skills,
    task_id: parameters.task_id,
    timeout_ms: parameters.timeout_ms,
    schema,
  }
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
  if (!isPlainObject(value)) {
    return false
  }
  return required.every(key => Object.prototype.hasOwnProperty.call(value, key))
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

  if (blocks.length === 0) {
    return prompt
  }
  return `<task_skills>\n${blocks.join('\n')}\n</task_skills>\n\n${prompt}`
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
  if (options.data !== undefined) {
    result.data = options.data
  }
  return result
}

const toStep = (label: string, description: string, result: SubtaskResult): StepRecord => ({
  label,
  description: description.slice(0, MAX_DESCRIPTION_CHARS),
  task_id: result.task_id,
  status: result.status,
  durationMs: result.durationMs,
  error: result.error,
  truncated: result.truncated,
})

// A throwing progress callback must never fail a run or skip cleanup, so every
// emission goes through this guard. The thrown value is logged and swallowed.
export const emitProgress = (
  context: WorkflowContext,
  progress: { title: string, metadata?: Record<string, unknown> },
): void => {
  try {
    context.onProgress?.(progress)
  }
  catch (error) {
    pushLog(context.logs, `progress callback threw: ${toErrorMessage(error)}`)
  }
}

const recordStep = (context: WorkflowContext, step: StepRecord): void => {
  // Emit the finish event for every settle path from the single point that sees
  // the final StepRecord, so no caller can forget to report completion.
  emitProgress(context, {
    title: step.label,
    metadata: {
      event: 'finish',
      status: step.status,
      task_id: step.task_id,
      durationMs: step.durationMs,
    },
  })
  if (context.steps.length < MAX_MAX_SUBTASKS_CAP) {
    context.steps.push(step)
  }
}

const attemptConfig = (
  parameters: SubtaskParameters,
): { timeout: number, label: string } => ({
  timeout: parameters.timeout_ms ?? DEFAULT_PER_SUBTASK_TIMEOUT_MS,
  label: parameters.description ?? parameters.prompt.slice(0, MAX_DESCRIPTION_CHARS),
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
  if (model !== undefined) {
    body.model = model
  }
  return body
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

const resolveSessionID = async (
  client: WorkflowSdkClient,
  parameters: SubtaskParameters,
  parentSessionID: string,
): Promise<string> => {
  if (parameters.task_id !== undefined && parameters.task_id !== '') {
    return parameters.task_id
  }
  const created = await client.session.create({
    body: { title: parameters.description ?? parameters.prompt.slice(0, MAX_DESCRIPTION_CHARS), parentID: parentSessionID },
  })
  return created.data?.id ?? ''
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
      error: `subtask timed out after ${context.timeoutMs}ms`,
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
  startedAt: number
}

const classifyError = (error: unknown, context: ErrorContext): SubtaskResult => {
  const durationMs = Date.now() - context.startedAt
  if (isAbortError(error) || context.child.signal.aborted || context.parentAborted) {
    const status: SubtaskStatus = context.timedOut ? 'timeout' : 'aborted'
    const message = context.timedOut
      ? `subtask timed out after ${context.timeoutMs}ms`
      : 'subtask aborted'
    return makeResult(status, context.sessionID, durationMs, { error: message })
  }
  return makeResult('error', context.sessionID, durationMs, { error: toErrorMessage(error) })
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

// A step's human-readable label falls back to the subtask label when the input
// carries no explicit description. Extracted so the fallback lives in one place
// and does not inflate the subtask attempt's cyclomatic complexity.
const stepLabel = (label: string, parameters: SubtaskParameters): string =>
  parameters.description ?? label

export const createSubtask = (context: WorkflowContext): SubtaskFunction => {
  const semaphore = createSemaphore(Math.max(1, context.maxConcurrent))

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
      recordStep(context, toStep('aborted', 'aborted', result))
      return result
    }

    let parameters: SubtaskParameters
    try {
      parameters = normalizeParameters(input)
    }
    catch (error) {
      const result = makeResult('error', '', 0, { error: toErrorMessage(error) })
      recordStep(context, toStep('invalid subtask input', 'invalid subtask input', result))
      return result
    }

    return semaphore.run(async (): Promise<SubtaskResult> => {
      const startedAt = Date.now()
      const { timeout, label } = attemptConfig(parameters)
      const child = new AbortController()
      // Register before session creation so the runner's timeout grace sees an
      // in-flight subtask even while `session.create` is still pending; otherwise
      // the grace is skipped and the step is dropped. Always removed in `finally`.
      context.active.add(child)
      emitProgress(context, {
        title: stepLabel(label, parameters),
        metadata: { event: 'start' },
      })
      let sessionID = ''
      let isTimedOut = false
      let timer: ReturnType<typeof setTimeout> | undefined
      let onParentAbort: (() => void) | undefined

      try {
        sessionID = await resolveSessionID(context.client, parameters, context.parentSessionID)
        if (sessionID === '') {
          const result = makeResult('error', '', Date.now() - startedAt, {
            error: 'failed to create subtask session',
          })
          recordStep(context, toStep(label, stepLabel(label, parameters), result))
          return result
        }

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
        }, timeout)

        const model = await resolveModelOnce()
        const turn = await runTurn(context, sessionID, child, parameters, finalPrompt, model, () => isTimedOut)

        // Clear before classifying so a timer that fires after the turn already
        // completed cannot retroactively flip a success into a timeout.
        if (timer !== undefined) {
          clearTimeout(timer)
          timer = undefined
        }

        const result = classifyResponse(turn.response, sessionID, startedAt, {
          timedOut: isTimedOut,
          parentAborted: context.signal.aborted,
          timeoutMs: timeout,
          parsed: turn.parsed,
        })
        recordStep(context, toStep(label, stepLabel(label, parameters), result))
        return result
      }
      catch (error) {
        if (error instanceof BudgetExceededError) {
          throw error
        }
        const result = classifyError(error, {
          child,
          parentAborted: context.signal.aborted,
          timeoutMs: timeout,
          timedOut: isTimedOut,
          sessionID,
          startedAt,
        })
        recordStep(context, toStep(label, stepLabel(label, parameters), result))
        return result
      }
      finally {
        finalizeAttempt(context, child, onParentAbort, timer)
      }
    })
  }
}
