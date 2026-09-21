import {
  DEFAULT_MAX_CONCURRENT,
  DEFAULT_MAX_SUBTASKS,
  DEFAULT_SUBTASK_AGENT,
  MAX_ENVELOPE_BYTES,
  MAX_MAX_CONCURRENT_CAP,
  MAX_MAX_SUBTASKS_CAP,
  createEmptyStats,
} from './workflow-types'
import type {
  LogFunction,
  ProgressFunction,
  SubtaskStatus,
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
  emitProgress,
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
  onProgress?: ProgressFunction
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
  return error instanceof BudgetExceededError ? true : typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'BudgetExceededError'
}

const timeoutMessage = (timeoutMs: number): string => `workflow timed out after ${timeoutMs}ms`

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
  // Serialize with an empty result so the `"result":""` key overhead is counted
  // in the base size, then fill the remaining budget with the sliced string.
  const base = { ...envelope, result: '', stats }
  const budget = cap - byteLength(stringifyEnvelopeJson(base)) - byteLength(MARKER)
  const text = stringifyResult(result)
  const truncated = text.length <= budget ? text : `${text.slice(0, Math.max(0, budget))}${MARKER}`
  return { ...envelope, result: truncated, stats }
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

const floorEnvelope = (envelope: WorkflowEnvelope): string =>
  JSON.stringify({
    status: envelope.status,
    error: envelope.error === undefined ? 'output too large' : envelope.error,
  })

// Linear size-fitting: keep the full envelope when it fits, drop logs, truncate
// the result, then drop steps from the end until it fits. The final floor keeps
// the envelope valid JSON even when even `{status,error}` exceeds the cap.
export const serializeEnvelope = (
  envelope: WorkflowEnvelope,
  maxBytes: number = MAX_ENVELOPE_BYTES,
): string => {
  const cap = Math.max(2, maxBytes)

  const full = serializeIfFits(envelope, cap)
  if (full !== undefined) {
    return full
  }

  const withoutLogs: WorkflowEnvelope = { ...envelope, logs: [] }
  const droppedLogs = serializeIfFits(withoutLogs, cap)
  if (droppedLogs !== undefined) {
    return droppedLogs
  }

  const truncatedResult = withTruncatedResult(withoutLogs, cap)
  const result = truncatedResult === undefined ? withoutLogs.result : truncatedResult.result
  return fitSteps(withoutLogs, result, truncatedResult !== undefined, cap) ?? floorEnvelope(envelope)
}

const resolveLimits = (options: RunWorkflowOptions): Limits => ({
  maxConcurrent: clamp(options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT, 1, MAX_MAX_CONCURRENT_CAP),
  maxSubtasks: clamp(options.maxSubtasks ?? DEFAULT_MAX_SUBTASKS, 1, MAX_MAX_SUBTASKS_CAP),
})

const createContext = (
  options: RunWorkflowOptions,
  limits: Limits,
  controller: AbortController,
): WorkflowContext => ({
  client: options.client,
  parentSessionID: options.parentSessionID,
  directory: options.directory,
  signal: controller.signal,
  defaultAgent: DEFAULT_SUBTASK_AGENT,
  maxConcurrent: limits.maxConcurrent,
  maxSubtasks: limits.maxSubtasks,
  budget: { used: 0 },
  steps: [],
  logs: [],
  active: new Set(),
  onProgress: options.onProgress,
})

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
    return serializeEnvelope(
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
    return serializeEnvelope(
      buildTerminalEnvelope('timeout', timeoutMessage(handling.timeoutMs), handling.context, handling.startedAt),
    )
  }
  const status: WorkflowEnvelope['status'] = isBudgetExceeded(error) ? 'budget_exceeded' : 'error'
  return serializeEnvelope(
    buildTerminalEnvelope(status, toErrorMessage(error), handling.context, handling.startedAt),
  )
}

const invalidScriptEnvelope = (script: string): string | undefined => {
  const checked = checkScript(script)
  if (checked.ok) {
    return undefined
  }
  const status: WorkflowEnvelope['status']
    = checked.reason.startsWith('forbidden token:') ? 'forbidden_script' : 'invalid_script'
  return serializeEnvelope(
    { status, error: checked.reason, steps: [], stats: createEmptyStats(), logs: [] },
  )
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
  return serializeEnvelope(
    buildTerminalEnvelope('aborted', ABORT_MESSAGE, context, startedAt),
  )
}

const executeWorkflow = async (options: RunWorkflowOptions): Promise<string> => {
  const limits = resolveLimits(options)

  const controller = new AbortController()
  const context = createContext(options, limits, controller)
  const startedAt = Date.now()

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
    // Route the script-facing helper through the same guard as the internal
    // emitters: a throwing onProgress is logged and swallowed, never propagated
    // into the script (which would surface as an `error` envelope).
    progress: progress => emitProgress(context, progress),
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
    return serializeEnvelope({
      status: 'ok',
      result,
      steps: context.steps,
      stats: computeStats(context, startedAt),
      logs: context.logs,
    })
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
    if (timer !== undefined) {
      clearTimeout(timer)
    }
    if (onExternalAbort !== undefined) {
      options.abort?.removeEventListener('abort', onExternalAbort)
    }
  }
}

export const runWorkflow = async (options: RunWorkflowOptions): Promise<string> => {
  const invalid = invalidScriptEnvelope(options.script)
  return invalid === undefined ? executeWorkflow(options) : invalid
}
