import { formatTimeoutMinutes, makeResult } from './subtask-result'
import { toErrorMessage } from './subtask-log'
import { extractOutputText } from './subtask-structured'
import type { ParsedStructured } from './subtask-structured'
import type { PromptResponse } from './subtask-turn'
import type { SubtaskResult, SubtaskStatus } from './contracts'

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'

interface ClassificationContext {
  timedOut: boolean
  parentAborted: boolean
  timeoutMinutes: number
  parsed: ParsedStructured | undefined
}

export const turnError = (response: PromptResponse): unknown => response.data?.info?.error

// A timed-out turn may come back as a resolved empty response, so timeout
// takes precedence over abort and any info.error carried by the response.
const terminalOutcome = (
  context: ClassificationContext,
  sessionID: string,
  durationMs: number,
): SubtaskResult | undefined => {
  if (context.timedOut) {
    return makeResult('timeout', sessionID, durationMs, {
      error: `subtask timed out after ${formatTimeoutMinutes(context.timeoutMinutes)}`,
    })
  }
  return context.parentAborted ? makeResult('aborted', sessionID, durationMs, { error: 'subtask aborted' }) : undefined
}

const isUnusable = (parsed: ParsedStructured | undefined): boolean => parsed?.usable === false

const outputResult = (
  parsed: ParsedStructured | undefined,
  outputText: string,
  sessionID: string,
  durationMs: number,
): SubtaskResult => {
  if (outputText.trim() === '') {
    return makeResult('empty', sessionID, durationMs, {
      outputText,
      error: 'subtask produced no output',
    })
  }
  return isUnusable(parsed)
    ? makeResult('error', sessionID, durationMs, {
        outputText,
        error: 'subtask did not return valid JSON matching the schema',
      })
    : okResult(parsed, outputText, sessionID, durationMs)
}

const okResult = (
  parsed: ParsedStructured | undefined,
  outputText: string,
  sessionID: string,
  durationMs: number,
): SubtaskResult =>
  makeResult('ok', sessionID, durationMs, { outputText, data: parsed?.value })

export const classifyResponse = (
  response: PromptResponse,
  sessionID: string,
  startedAt: number,
  context: ClassificationContext,
): SubtaskResult => {
  const durationMs = Date.now() - startedAt

  const terminal = terminalOutcome(context, sessionID, durationMs)
  if (terminal !== undefined) return terminal

  const errorInfo = turnError(response)
  return errorInfo
    ? makeResult('error', sessionID, durationMs, { error: toErrorMessage(errorInfo) })
    : outputResult(context.parsed, extractOutputText(response.data), sessionID, durationMs)
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

const abortResult = (context: ErrorContext, durationMs: number): SubtaskResult => {
  const status: SubtaskStatus = context.timedOut ? 'timeout' : 'aborted'
  const message = context.timedOut
    ? `subtask timed out after ${formatTimeoutMinutes(context.timeoutMinutes)}`
    : 'subtask aborted'
  return makeResult(status, context.sessionID, durationMs, { error: message })
}

const isAbortOutcome = (error: unknown, context: ErrorContext): boolean =>
  isAbortError(error) || context.child.signal.aborted || context.parentAborted

export const classifyError = (error: unknown, context: ErrorContext): SubtaskResult => {
  const durationMs = Date.now() - context.startedAt
  const result = isAbortOutcome(error, context)
    ? abortResult(context, durationMs)
    : makeResult('error', context.sessionID, durationMs, { error: toErrorMessage(error) })
  // A fork that succeeded before a later phase failed still created a session,
  // so its provenance survives the error classification.
  return context.forkedFrom === undefined ? result : { ...result, forked_from: context.forkedFrom }
}
