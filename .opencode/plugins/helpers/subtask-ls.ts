import { MAX_DESCRIPTION_CHARS } from './workflow-types'
import type { LsEntry, StepRecord, SubtaskStatus } from './workflow-types'

export const DEFAULT_LS_COUNT = 10
export const MAX_LS_COUNT = 50

export interface ListStepsOptions {
  count?: number
  status?: SubtaskStatus
}

// Latest completed run snapshot, shared across sessions in the same server
// process. A restart clears it, so subtask_ls reports no rows until the next run.
const lastSteps: StepRecord[] = []

export const recordSteps = (steps: StepRecord[]): void => {
  lastSteps.length = 0
  lastSteps.push(...steps)
}

export const readStoredSteps = (): StepRecord[] => [...lastSteps]

const resolveCount = (count: number | undefined): number => {
  return Number.isFinite(count) ? Math.min(Math.max(Math.floor(count as number), 1), MAX_LS_COUNT) : DEFAULT_LS_COUNT
}

const truncateDescription = (description: string): string =>
  description.length > MAX_DESCRIPTION_CHARS ? description.slice(0, MAX_DESCRIPTION_CHARS) : description

export const listSteps = (steps: StepRecord[], options: ListStepsOptions): LsEntry[] => {
  const wanted = resolveCount(options.count)
  const filtered = options.status === undefined ? steps : steps.filter(step => step.status === options.status)
  return filtered.slice(0, wanted).map(step => ({
    description: truncateDescription(step.description),
    durationMs: step.durationMs,
    task_id: step.task_id,
    status: step.status,
  }))
}
