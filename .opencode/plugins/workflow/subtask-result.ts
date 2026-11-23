import {
  DEFAULT_PER_SUBTASK_TIMEOUT_MINUTES,
  MAX_DESCRIPTION_CHARS,
  MAX_MAX_SUBTASKS_CAP,
} from './contracts'
import type { NormalizedSubtaskParameters } from './subtask-parameters'
import type { StepRecord, SubtaskResult, SubtaskStatus, WorkflowContext } from './contracts'

const withData = (result: SubtaskResult, data: unknown): SubtaskResult =>
  data === undefined ? result : { ...result, data }

export const makeResult = (
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
  return withData(result, options.data)
}

export const toStep = (description: string, result: SubtaskResult): StepRecord => ({
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

export const recordStep = (context: WorkflowContext, step: StepRecord): void => {
  if (context.steps.length < MAX_MAX_SUBTASKS_CAP) {
    context.steps.push(step)
  }
}

// The single minutes→ms boundary for subtasks: caller-facing `timeout_minutes`
// becomes the Node timer's millisecond value here; everything upstream stays in
// minutes, and the runner keeps millisecond semantics internally.
export const attemptConfig = (
  parameters: NormalizedSubtaskParameters,
): { timeoutMs: number, timeoutMinutes: number, label: string } => {
  const timeoutMinutes = parameters.timeout_minutes ?? DEFAULT_PER_SUBTASK_TIMEOUT_MINUTES
  return { timeoutMs: timeoutMinutes * 60_000, timeoutMinutes, label: parameters.description }
}
