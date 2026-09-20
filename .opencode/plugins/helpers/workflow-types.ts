export interface WorkflowSessionMessageInfo {
  role?: string
  providerID?: string
  modelID?: string
  model?: { providerID?: string, modelID?: string }
}

export interface WorkflowSessionMessage {
  info?: WorkflowSessionMessageInfo
}

export interface WorkflowSdkClient {
  session: {
    create(input: { body: { title: string, parentID?: string } }): Promise<{ data?: { id: string } }>
    prompt(input: {
      path: { id: string }
      signal?: AbortSignal
      body: {
        agent: string
        parts: Array<{ type: 'text', text: string }>
        model?: { providerID: string, modelID: string }
      }
    }): Promise<{ data?: { info?: { error?: unknown }, parts?: Array<{ type?: string, text?: string }> } }>
    messages?(input: {
      path: { id: string }
    }): Promise<{ data?: WorkflowSessionMessage[] }>
    abort?(input: { path: { id: string } }): Promise<unknown>
  }
}

export type SubtaskStatus = 'ok' | 'error' | 'empty' | 'timeout' | 'aborted'

export interface SubtaskParameters {
  prompt: string
  description?: string
  agent?: string
  skills?: string[]
  task_id?: string
  timeout_ms?: number
  schema?: Record<string, unknown>
}

export type SubtaskInput = string | SubtaskParameters

export interface SubtaskResult {
  outputText: string
  task_id: string
  status: SubtaskStatus
  error?: string
  durationMs: number
  truncated: boolean
  data?: unknown
}

export interface StepRecord {
  label: string
  description: string
  task_id: string
  status: SubtaskStatus
  durationMs: number
  error?: string
  truncated: boolean
}

export interface WorkflowStats {
  subtasks: number
  ok: number
  error: number
  empty: number
  timeout: number
  aborted: number
  totalMs: number
  truncated: boolean
}

// Progress payload surfaced to the harness: `title` drives the status line and
// `metadata.event` distinguishes the start/finish lifecycle of a subtask.
export type ProgressFunction = (progress: {
  title: string
  metadata?: Record<string, unknown>
}) => void

export interface WorkflowEnvelope {
  status: 'ok' | 'error' | 'timeout' | 'aborted' | 'budget_exceeded' | 'invalid_script' | 'forbidden_script'
  result?: unknown
  error?: string
  steps: StepRecord[]
  stats: WorkflowStats
  logs: string[]
}

export interface WorkflowContext {
  client: WorkflowSdkClient
  parentSessionID: string
  directory?: string
  signal: AbortSignal
  defaultAgent: string
  maxConcurrent: number
  maxSubtasks: number
  budget: { used: number }
  steps: StepRecord[]
  logs: string[]
  active: Set<AbortController>
  onProgress?: ProgressFunction
}

export type LogFunction = (message: unknown) => void

export type SubtaskFunction = (input: SubtaskInput) => Promise<SubtaskResult>

export interface WorkflowHelpers {
  subtask: SubtaskFunction
  log: LogFunction
  progress: ProgressFunction
}

export const DEFAULT_TIMEOUT_SECONDS = 600
export const DEFAULT_PER_SUBTASK_TIMEOUT_MS = 300_000
export const DEFAULT_SUBTASK_AGENT = 'rug-swe'
export const DEFAULT_MAX_CONCURRENT = 4
export const MAX_MAX_CONCURRENT_CAP = 8
export const DEFAULT_MAX_SUBTASKS = 32
export const MAX_MAX_SUBTASKS_CAP = 64
export const MAX_STEP_OUTPUT_CHARS = 4000
export const MAX_ENVELOPE_BYTES = 8192
export const MAX_LOGS = 100
export const MAX_LOG_CHARS = 500
export const MAX_DESCRIPTION_CHARS = 80

export const createEmptyStats = (): WorkflowStats => ({
  subtasks: 0,
  ok: 0,
  error: 0,
  empty: 0,
  timeout: 0,
  aborted: 0,
  totalMs: 0,
  truncated: false,
})
