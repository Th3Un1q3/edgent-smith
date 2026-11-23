import { classifyError, classifyResponse } from './subtask-classify'
import { createLogger } from './subtask-log'
import { attemptConfig, makeResult, recordStep, toStep } from './subtask-result'
import { injectSkills } from './subtask-skills'
import { resolveSessionID, runTurn } from './subtask-turn'
import type { NormalizedSubtaskParameters } from './subtask-parameters'
import type { ParentModel } from './subtask-model'
import type { SkillLister } from './subtask-skills'
import type { SubtaskResult, WorkflowContext, WorkflowSdkClient } from './contracts'

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExceededError'
  }
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

type CompletedTurn = Awaited<ReturnType<typeof runTurn>>

// A finished turn becomes a recorded result: classification decides the status,
// and a session actually forked on this attempt carries its origin as provenance.
const completeAttempt = (
  context: WorkflowContext,
  label: string,
  startedAt: number,
  turn: CompletedTurn,
  attempt: {
    sessionID: string
    timeoutMinutes: number
    timedOut: boolean
    forkedFrom: string | undefined
  },
): SubtaskResult => {
  const classified = classifyResponse(turn.response, attempt.sessionID, startedAt, {
    timedOut: attempt.timedOut,
    parentAborted: context.signal.aborted,
    timeoutMinutes: attempt.timeoutMinutes,
    parsed: turn.parsed,
  })
  const result = attempt.forkedFrom === undefined
    ? classified
    : { ...classified, forked_from: attempt.forkedFrom }
  recordStep(context, toStep(label, result))
  return result
}

// The plugin entry point hands the native skill domain down; a context without
// it (tests, other callers) falls back to the server's own skill list.
export interface SkillAwareContext extends WorkflowContext {
  skill?: SkillLister
}

const resolvePromptText = async (
  context: SkillAwareContext,
  parameters: NormalizedSubtaskParameters,
): Promise<string> =>
  hasSkills(parameters.skills)
    ? injectSkills(parameters.prompt, parameters.skills, {
        directory: context.directory,
        list: context.skill,
        log: createLogger(context.logs),
      })
    : parameters.prompt

const recoverAttempt = (
  error: unknown,
  context: SkillAwareContext,
  state: {
    child: AbortController
    label: string
    sessionID: string
    timeoutMinutes: number
    timedOut: boolean
    forkedFrom?: string
    startedAt: number
  },
): SubtaskResult => {
  if (error instanceof BudgetExceededError) {
    throw error
  }
  const result = classifyError(error, {
    child: state.child,
    parentAborted: context.signal.aborted,
    timeoutMinutes: state.timeoutMinutes,
    timedOut: state.timedOut,
    sessionID: state.sessionID,
    // Only a fork that already returned an id reaches the catch with
    // `forkedFrom` set; a failed fork leaves it undefined.
    forkedFrom: state.forkedFrom,
    startedAt: state.startedAt,
  })
  recordStep(context, toStep(state.label, result))
  return result
}

export const runAttempt = async (
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
  let forkedFrom: string | undefined
  let isTimedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let onParentAbort: (() => void) | undefined

  // Stop the watchdog before classifying so a timer that fires after the turn
  // already completed cannot retroactively flip a success into a timeout.
  const stopTimer = (): void => {
    if (timer === undefined) {
      return
    }
    clearTimeout(timer)
    timer = undefined
  }

  try {
    const resolved = await resolveSessionID(context.client, parameters, context.parentSessionID)
    sessionID = resolved.sessionID
    if (sessionID === '') {
      const result = makeResult('error', '', Date.now() - startedAt, {
        error: 'failed to create subtask session',
      })
      recordStep(context, toStep(label, result))
      return result
    }
    forkedFrom = resolved.forkedFrom

    const finalPrompt = await resolvePromptText(context, parameters)

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
    stopTimer()

    return completeAttempt(context, label, startedAt, turn, {
      sessionID,
      timeoutMinutes,
      timedOut: isTimedOut,
      forkedFrom,
    })
  }
  catch (error) {
    return recoverAttempt(error, context, {
      child,
      label,
      sessionID,
      timeoutMinutes,
      timedOut: isTimedOut,
      forkedFrom,
      startedAt,
    })
  }
  finally {
    finalizeAttempt(context, child, onParentAbort, timer)
  }
}
