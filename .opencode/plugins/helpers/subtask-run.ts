import { createSubtask } from './workflow-subtask'
import { DEFAULT_MAX_SUBTASKS, DEFAULT_SUBTASK_AGENT } from './workflow-types'
import type { SubtaskInput, SubtaskResult, WorkflowSdkClient } from './workflow-types'

export interface StandaloneRunOptions {
  client: WorkflowSdkClient
  parentSessionID: string
  directory?: string
  signal?: AbortSignal
  defaultAgent?: string
}

export const runStandaloneSubtask = async (
  options: StandaloneRunOptions,
  input: SubtaskInput,
): Promise<SubtaskResult> => {
  const subtask = createSubtask({
    client: options.client,
    parentSessionID: options.parentSessionID,
    directory: options.directory,
    signal: options.signal ?? new AbortController().signal,
    defaultAgent: options.defaultAgent ?? DEFAULT_SUBTASK_AGENT,
    maxConcurrent: 1,
    maxSubtasks: DEFAULT_MAX_SUBTASKS,
    budget: { used: 0 },
    steps: [],
    logs: [],
    active: new Set<AbortController>(),
  })
  return subtask(input)
}
