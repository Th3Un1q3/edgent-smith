import { BudgetExceededError, runAttempt } from './subtask-attempt'
import { createLogger, toErrorMessage } from './subtask-log'
import { resolveParentModel } from './subtask-model'
import { makeResult, recordStep, toStep } from './subtask-result'
import { normalizeParameters } from './subtask-parameters'
import type { SkillAwareContext } from './subtask-attempt'
import type { NormalizedSubtaskParameters } from './subtask-parameters'
import type { ParentModel } from './subtask-model'
import type { SubtaskFunction, SubtaskInput, SubtaskResult } from './contracts'

export { BudgetExceededError, linkParentAbort } from './subtask-attempt'
export { normalizeParameters } from './subtask-parameters'
export { extractOutputText, parseStructured } from './subtask-structured'
export { frontmatterDescription, injectSkills, stripFrontmatter } from './subtask-skills'
export { pushLog, stringifyLogMessage, toErrorMessage } from './subtask-log'
export { resolveParentModel } from './subtask-model'
export { formatTimeoutMinutes } from './subtask-result'
export type { SkillAwareContext } from './subtask-attempt'
export type { ParsedStructured } from './subtask-structured'
export type { SkillInjectionOptions, SkillLister, SkillRecord } from './subtask-skills'
export type { ParentModel } from './subtask-model'

const reserveBudget = (context: SkillAwareContext): void => {
  if (context.budget.used >= context.maxSubtasks) {
    throw new BudgetExceededError(`workflow subtask budget exceeded (${context.maxSubtasks})`)
  }
  context.budget.used += 1
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
    reserveBudget(context)

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
