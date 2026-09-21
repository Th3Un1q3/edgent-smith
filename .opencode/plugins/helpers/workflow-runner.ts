import {
  DEFAULT_MAX_CONCURRENT,
  DEFAULT_MAX_SUBTASKS,
  DEFAULT_SUBTASK_AGENT,
  MAX_ENVELOPE_BYTES,
  MAX_MAX_CONCURRENT_CAP,
  MAX_MAX_SUBTASKS_CAP,
  createEmptyStats,
  createRunId,
} from './workflow-types'
import type {
  LogFunction,
  NotifyFunction,
  SubtaskStatus,
  ToastInput,
  WorkflowContext,
  WorkflowEnvelope,
  WorkflowHelpers,
  WorkflowSdkClient,
  WorkflowStats,
} from './workflow-types'
import { buildWorkflowFunction, checkScript } from './workflow-script'
import {
  BudgetExceededError,
  createSubtask,
  formatElapsed,
  linkParentAbort,
  pushLog,
  toErrorMessage,
} from './workflow-subtask'

export { buildWorkflowFunction, checkScript } from './workflow-script'
export { BudgetExceededError, createSubtask } from './workflow-subtask'
export { DEFAULT_TIMEOUT_SECONDS } from './workflow-types'
export type {
  StepRecord,
  WorkflowEnvelope,
  WorkflowSdkClient,
  WorkflowStats,
} from './workflow-types'

export interface RunWorkflowOptions {
  script: string
  client: WorkflowSdkClient
  parentSessionID: string
  directory?: string
  timeoutMs: number
  maxConcurrent?: number
  maxSubtasks?: number
  abort?: AbortSignal
}

interface Limits {
  maxConcurrent: number
  maxSubtasks: number
}

interface FailureHandling {
  timedOut: boolean
  aborted: boolean
  scriptPromise: Promise<unknown>
  context: WorkflowContext
  startedAt: number
  timeoutMs: number
}

const MARKER = '…[truncated]'
const TIMEOUT_GRACE_MS = 250

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const isBudgetExceeded = (error: unknown): boolean => {
  if (error instanceof BudgetExceededError) {
    return true
  }
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'BudgetExceededError'
}

const timeoutMessage = (timeoutMs: number): string => `workflow timed out after ${formatElapsed(timeoutMs)}`

const byteLength = (value: string): number => Buffer.byteLength(value, 'utf8')

const createLogFunction = (logs: string[]): LogFunction => (message) => {
  pushLog(logs, message)
}

const countStep = (stats: WorkflowStats, status: SubtaskStatus): void => {
  switch (status) {
    case 'ok': {
      stats.ok += 1
      break
    }
    case 'error': {
      stats.error += 1
      break
    }
    case 'empty': {
      stats.empty += 1
      break
    }
    case 'timeout': {
      stats.timeout += 1
      break
    }
    case 'aborted': {
      stats.aborted += 1
      break
    }
  }
}

const computeStats = (context: WorkflowContext, startedAt: number): WorkflowStats => {
  const stats = createEmptyStats()
  stats.subtasks = context.budget.used
  for (const step of context.steps) {
    countStep(stats, step.status)
    if (step.truncated) {
      stats.truncated = true
    }
  }
  stats.totalMs = Date.now() - startedAt
  return stats
}

const stringifyResult = (result: unknown): string => {
  if (typeof result === 'string') {
    return result
  }
  try {
    return JSON.stringify(result) ?? String(result)
  }
  catch {
    return String(result)
  }
}

const stringifyEnvelopeJson = (envelope: WorkflowEnvelope): string => {
  try {
    return JSON.stringify(envelope)
  }
  catch {
    return JSON.stringify({ ...envelope, result: stringifyResult(envelope.result) })
  }
}

const serializeIfFits = (envelope: WorkflowEnvelope, cap: number): string | undefined => {
  const json = stringifyEnvelopeJson(envelope)
  return byteLength(json) <= cap ? json : undefined
}

// Longest prefix of `text` whose UTF-8 encoding is at most `budget` bytes.
// Iterates code points so a multi-byte character is never split in half.
const truncateUtf8 = (text: string, budget: number): string => {
  if (budget <= 0) {
    return ''
  }
  if (byteLength(text) <= budget) {
    return text
  }
  let used = 0
  let kept = ''
  for (const character of text) {
    const size = byteLength(character)
    if (used + size > budget) {
      break
    }
    used += size
    kept += character
  }
  return kept
}

// Longest prefix of `text` whose JSON-encoded (escaped) form fits `budget`
// bytes. JSON escaping can exceed the raw byte size, so shrink by the measured
// overflow until the encoded value fits.
const truncateEncoded = (text: string, budget: number): string => {
  let kept = truncateUtf8(text, Math.max(0, budget))
  while (kept.length > 0) {
    const encoded = byteLength(JSON.stringify(kept))
    if (encoded <= budget) {
      return kept
    }
    kept = truncateUtf8(kept, byteLength(kept) - (encoded - budget))
  }
  return kept
}

// Truncate a stringifiable result to the budget left after the rest of the
// envelope (with `result` omitted) is serialized. Returns undefined for a
// missing/null result, which is left to the step-dropping pass unchanged.
const withTruncatedResult = (
  envelope: WorkflowEnvelope,
  cap: number,
): WorkflowEnvelope | undefined => {
  const { result } = envelope
  if (result === undefined || result === null) {
    return
  }
  const stats = { ...envelope.stats, truncated: true }
  const text = stringifyResult(result)
  // Serialize with an empty result so the `"result":""` key overhead counts in
  // the base size. `base` includes the two quotes around the empty string, so
  // the encoded-result budget is `cap - baseBytes + 2`.
  const base = { ...envelope, result: '', stats }
  const encodedBudget = cap - byteLength(stringifyEnvelopeJson(base)) + 2
  if (byteLength(JSON.stringify(text)) <= encodedBudget) {
    return { ...envelope, result: text, stats }
  }
  const markerBudget = encodedBudget - byteLength(JSON.stringify(MARKER))
  return { ...envelope, result: `${truncateEncoded(text, markerBudget)}${MARKER}`, stats }
}

// Drop steps from the end until the envelope fits, keeping the (possibly
// truncated) result. Returns undefined when even zero steps is too large.
const fitSteps = (
  envelope: WorkflowEnvelope,
  result: unknown,
  didTruncateResult: boolean,
  cap: number,
): string | undefined => {
  for (let kept = envelope.steps.length; kept >= 0; kept -= 1) {
    const candidate: WorkflowEnvelope = {
      ...envelope,
      result,
      steps: envelope.steps.slice(0, kept),
      stats: {
        ...envelope.stats,
        truncated: envelope.stats.truncated || didTruncateResult || kept < envelope.steps.length,
      },
    }
    const json = serializeIfFits(candidate, cap)
    if (json !== undefined) {
      return json
    }
  }
}

// Bound an oversized `error` field so the rest of the envelope (result, steps)
// still has room. Returns undefined when the error is absent or already fits,
// leaving the caller's envelope untouched.
const withBoundedError = (
  envelope: WorkflowEnvelope,
  cap: number,
): WorkflowEnvelope | undefined => {
  const { error } = envelope
  if (error === undefined) {
    return undefined
  }
  // `error: ''` keeps the key overhead (including its two quotes) in the base,
  // mirroring `withTruncatedResult`; the encoded error then uses what is left.
  const base = { ...envelope, error: '' }
  const encodedBudget = cap - byteLength(stringifyEnvelopeJson(base)) + 2
  if (byteLength(JSON.stringify(error)) <= encodedBudget) {
    return undefined
  }
  const markerBudget = encodedBudget - byteLength(JSON.stringify(MARKER))
  return {
    ...envelope,
    error: `${truncateEncoded(error, markerBudget)}${MARKER}`,
    stats: { ...envelope.stats, truncated: true },
  }
}

const FALLBACK_ERROR = 'output too large'

// Last-resort envelope: valid JSON that keeps `status` and never carries the
// unbounded original error. Prefers the error when it fits, otherwise a
// byte-truncated error, and finally a short fixed-size error.
const floorEnvelope = (envelope: WorkflowEnvelope, cap: number): string => {
  const { status } = envelope
  const error = envelope.error ?? FALLBACK_ERROR
  const full = JSON.stringify({ status, error })
  if (byteLength(full) <= cap) {
    return full
  }
  const base = byteLength(JSON.stringify({ status, error: '' }))
  const encodedBudget = cap - base + 2
  const markerBudget = encodedBudget - byteLength(JSON.stringify(MARKER))
  const bounded = markerBudget > 0
    ? `${truncateEncoded(error, markerBudget)}${MARKER}`
    : FALLBACK_ERROR
  const candidate = JSON.stringify({ status, error: bounded })
  return byteLength(candidate) <= cap ? candidate : JSON.stringify({ status, error: FALLBACK_ERROR })
}

// Bound an oversized error and return the serialized envelope when that alone
// brings it under the cap; otherwise return the envelope for further trimming.
const fitBoundedError = (
  envelope: WorkflowEnvelope,
  cap: number,
): string | WorkflowEnvelope => {
  const bounded = withBoundedError(envelope, cap)
  if (bounded === undefined) {
    return envelope
  }
  return serializeIfFits(bounded, cap) ?? bounded
}

// Linear size-fitting: keep the full envelope when it fits, drop logs, bound an
// oversized error, truncate the result, then drop steps from the end until it
// fits. The final floor stays valid JSON even when even `{status,error}` exceeds
// the cap.
export const serializeEnvelope = (
  envelope: WorkflowEnvelope,
  maxBytes: number = MAX_ENVELOPE_BYTES,
): string => {
  const cap = Math.max(2, maxBytes)

  const full = serializeIfFits(envelope, cap)
  if (full !== undefined) {
    return full
  }

  const withoutLogs: WorkflowEnvelope = {
    ...envelope,
    logs: [],
    stats: { ...envelope.stats, truncated: true },
  }
  const droppedLogs = serializeIfFits(withoutLogs, cap)
  if (droppedLogs !== undefined) {
    return droppedLogs
  }

  // An oversized error would otherwise survive every later pass and blow the
  // cap, so bound it before sacrificing the result or the steps.
  const boundedBase = fitBoundedError(withoutLogs, cap)
  if (typeof boundedBase === 'string') {
    return boundedBase
  }

  const truncatedResult = withTruncatedResult(boundedBase, cap)
  const result = truncatedResult === undefined ? boundedBase.result : truncatedResult.result
  return fitSteps(boundedBase, result, truncatedResult !== undefined, cap) ?? floorEnvelope(envelope, cap)
}

const resolveLimits = (options: RunWorkflowOptions): Limits => ({
  maxConcurrent: clamp(options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT, 1, MAX_MAX_CONCURRENT_CAP),
  maxSubtasks: clamp(options.maxSubtasks ?? DEFAULT_MAX_SUBTASKS, 1, MAX_MAX_SUBTASKS_CAP),
})

// Toast sink built from the captured client (`client.tui.showToast({ body })`,
// v1 SDK). Calls are fire-and-forget: a synchronous throw or a rejected promise
// is logged and swallowed so notifications can never fail a run.
const createNotifier = (client: WorkflowSdkClient, logs: string[]): NotifyFunction => {
  const tui = client.tui
  if (tui?.showToast === undefined) {
    return () => {}
  }
  const { showToast } = tui
  const send = async (toast: ToastInput): Promise<void> => {
    try {
      await showToast.call(tui, { body: toast })
    }
    catch (error) {
      pushLog(logs, `toast failed: ${toErrorMessage(error)}`)
    }
  }
  return (toast) => {
    void send(toast)
  }
}

// Minimal sink for best-effort toasts. Accepts a full `WorkflowContext` as well
// as the ad-hoc `{ logs, notify }` used before a context exists.
type ToastSink = Pick<WorkflowContext, 'logs' | 'notify'>

const emitToast = (context: ToastSink, toast: ToastInput): void => {
  try {
    context.notify?.(toast)
  }
  catch (error) {
    pushLog(context.logs, `toast failed: ${toErrorMessage(error)}`)
  }
}

const WORKFLOW_TOAST_TITLE = 'workflow'

// Locked terminal messages: success carries `<ok>/<n> subtasks · <elapsed>s`;
// timeout and abort are warnings; every other failure is an error.
const terminalToast = (envelope: WorkflowEnvelope, runId: string): ToastInput => {
  if (envelope.status === 'ok') {
    const elapsed = formatElapsed(envelope.stats.totalMs)
    return {
      title: WORKFLOW_TOAST_TITLE,
      message: `workflow ok · ${envelope.stats.ok}/${envelope.stats.subtasks} subtasks · ${runId} · ${elapsed}`,
      variant: 'success',
    }
  }
  if (envelope.status === 'timeout') {
    return {
      title: WORKFLOW_TOAST_TITLE,
      message: `${envelope.error ?? 'workflow timed out'} · ${runId}`,
      variant: 'warning',
    }
  }
  if (envelope.status === 'aborted') {
    return {
      title: WORKFLOW_TOAST_TITLE,
      message: `${envelope.error ?? 'workflow aborted'} · ${runId}`,
      variant: 'warning',
    }
  }
  const detail = envelope.error === undefined ? '' : ` · ${envelope.error}`
  return { title: WORKFLOW_TOAST_TITLE, message: `workflow ${envelope.status} · ${runId}${detail}`, variant: 'error' }
}

const createContext = (
  options: RunWorkflowOptions,
  limits: Limits,
  controller: AbortController,
  runId: string,
): WorkflowContext => {
  const logs: string[] = []
  return {
    client: options.client,
    parentSessionID: options.parentSessionID,
    directory: options.directory,
    signal: controller.signal,
    defaultAgent: DEFAULT_SUBTASK_AGENT,
    maxConcurrent: limits.maxConcurrent,
    maxSubtasks: limits.maxSubtasks,
    budget: { used: 0 },
    steps: [],
    logs,
    active: new Set(),
    running: new Map(),
    startedAt: Date.now(),
    runId,
    notify: createNotifier(options.client, logs),
  }
}

// Emit the terminal toast for an envelope and serialize it. The toast is
// best-effort (see `emitToast`); serialization never throws.
const serializeWithToast = (context: WorkflowContext, envelope: WorkflowEnvelope): string => {
  emitToast(context, terminalToast(envelope, context.runId ?? ''))
  return serializeEnvelope(envelope)
}

const buildTerminalEnvelope = (
  status: WorkflowEnvelope['status'],
  error: string,
  context: WorkflowContext,
  startedAt: number,
): WorkflowEnvelope => ({
  status,
  error,
  steps: context.steps,
  stats: computeStats(context, startedAt),
  logs: context.logs,
})

const settleWithinGrace = async (promise: Promise<unknown>, graceMs: number): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const grace = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, graceMs)
  })
  try {
    await Promise.race([Promise.allSettled([promise]), grace])
  }
  finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}

const ABORT_MESSAGE = 'workflow aborted'

const handleFailure = async (error: unknown, handling: FailureHandling): Promise<string> => {
  if (handling.aborted) {
    // Same grace as the timeout path: let in-flight subtasks record their
    // aborted steps before the envelope is serialized.
    if (handling.context.active.size > 0) {
      await settleWithinGrace(handling.scriptPromise, TIMEOUT_GRACE_MS)
    }
    return serializeWithToast(
      handling.context,
      buildTerminalEnvelope('aborted', ABORT_MESSAGE, handling.context, handling.startedAt),
    )
  }
  if (handling.timedOut) {
    // The grace exists to let in-flight subtasks record their aborted steps.
    // A script with none has nothing left to settle, so skip it entirely
    // instead of stalling for the full grace duration.
    if (handling.context.active.size > 0) {
      await settleWithinGrace(handling.scriptPromise, TIMEOUT_GRACE_MS)
    }
    return serializeWithToast(
      handling.context,
      buildTerminalEnvelope('timeout', timeoutMessage(handling.timeoutMs), handling.context, handling.startedAt),
    )
  }
  const status: WorkflowEnvelope['status'] = isBudgetExceeded(error) ? 'budget_exceeded' : 'error'
  return serializeWithToast(
    handling.context,
    buildTerminalEnvelope(status, toErrorMessage(error), handling.context, handling.startedAt),
  )
}

// Every exit emits exactly one terminal toast, including a script that never
// ran. The toast is best-effort; a missing notifications channel is a no-op.
const emitTerminalToast = (client: WorkflowSdkClient, envelope: WorkflowEnvelope, runId: string): void => {
  const logs: string[] = []
  emitToast({ logs, notify: createNotifier(client, logs) }, terminalToast(envelope, runId))
}

const invalidScriptEnvelope = (options: RunWorkflowOptions, runId: string): string | undefined => {
  const checked = checkScript(options.script)
  if (checked.ok) {
    return undefined
  }
  const status: WorkflowEnvelope['status']
    = checked.reason.startsWith('forbidden token:') ? 'forbidden_script' : 'invalid_script'
  const envelope: WorkflowEnvelope = {
    status,
    error: checked.reason,
    steps: [],
    stats: createEmptyStats(),
    logs: [],
  }
  // The script never executed, but an invalid/forbidden run must not be silent:
  // route it through the same terminal-toast path as every other exit.
  emitTerminalToast(options.client, envelope, runId)
  return serializeEnvelope(envelope)
}

const alreadyAbortedEnvelope = (
  options: RunWorkflowOptions,
  onExternalAbort: (() => void) | undefined,
  context: WorkflowContext,
  startedAt: number,
): string | undefined => {
  if (options.abort?.aborted !== true) {
    return undefined
  }
  if (onExternalAbort !== undefined) {
    options.abort.removeEventListener('abort', onExternalAbort)
  }
  return serializeWithToast(
    context,
    buildTerminalEnvelope('aborted', ABORT_MESSAGE, context, startedAt),
  )
}

const stopRun = (
  timer: ReturnType<typeof setTimeout> | undefined,
  options: RunWorkflowOptions,
  onExternalAbort: (() => void) | undefined,
): void => {
  if (timer !== undefined) {
    clearTimeout(timer)
  }
  if (onExternalAbort !== undefined) {
    options.abort?.removeEventListener('abort', onExternalAbort)
  }
}

const executeWorkflow = async (options: RunWorkflowOptions, runId: string): Promise<string> => {
  const limits = resolveLimits(options)

  const controller = new AbortController()
  const context = createContext(options, limits, controller, runId)
  const startedAt = Date.now()

  // First notification of the run, emitted before the script starts executing.
  emitToast(context, { title: WORKFLOW_TOAST_TITLE, message: `started · ${runId}`, variant: 'info' })

  // Share one parent-abort linker with the subtasks: the external signal aborts
  // the internal controller, which in turn aborts every in-flight child.
  const onExternalAbort = options.abort === undefined
    ? undefined
    : linkParentAbort(options.abort, controller)

  // An already-aborted external signal must win deterministically: both
  // `abortPromise` and the (immediate) `scriptPromise` settle before the race
  // attaches handlers, and `Promise.race` would otherwise favour script
  // resolution. Return the abort envelope before either promise is created.
  const earlyAbort = alreadyAbortedEnvelope(options, onExternalAbort, context, startedAt)
  if (earlyAbort !== undefined) {
    return earlyAbort
  }

  let isTimedOut = false
  let isAborted = false

  // Settles the run when the internal controller aborts. The timeout sets
  // `isTimedOut` before aborting, so an abort without a timeout is external.
  const abortPromise = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => {
      if (!isTimedOut) {
        isAborted = true
      }
      reject(new Error(ABORT_MESSAGE))
    }, { once: true })
  })

  const helpers: WorkflowHelpers = {
    subtask: createSubtask(context),
    log: createLogFunction(context.logs),
  }
  const scriptPromise = buildWorkflowFunction(options.script)(helpers)

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      isTimedOut = true
      controller.abort()
      reject(new Error(timeoutMessage(options.timeoutMs)))
    }, options.timeoutMs)
  })

  try {
    const result = await Promise.race([scriptPromise, timeoutPromise, abortPromise])
    const envelope: WorkflowEnvelope = {
      status: 'ok',
      result,
      steps: context.steps,
      stats: computeStats(context, startedAt),
      logs: context.logs,
    }
    emitToast(context, terminalToast(envelope, context.runId ?? ''))
    return serializeEnvelope(envelope)
  }
  catch (error) {
    return handleFailure(error, {
      timedOut: isTimedOut,
      aborted: isAborted,
      scriptPromise,
      context,
      startedAt,
      timeoutMs: options.timeoutMs,
    })
  }
  finally {
    stopRun(timer, options, onExternalAbort)
  }
}

export const runWorkflow = async (options: RunWorkflowOptions): Promise<string> => {
  // One id per run, generated at the boundary so even a script that never
  // executes (invalid/forbidden) emits a correlatable terminal signal.
  const runId = createRunId()
  const invalid = invalidScriptEnvelope(options, runId)
  if (invalid !== undefined) {
    return invalid
  }
  return executeWorkflow(options, runId)
}
