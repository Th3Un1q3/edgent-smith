interface WorkflowSessionMessageInfo {
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
    // v2 SDK shape: the source session id is `sessionID` and the optional
    // boundary is `before`. Omitting `before` forks at the latest message.
    fork?(input: {
      sessionID: string
      before?: string
    }): Promise<{ data?: { id?: string } }>
    prompt(input: {
      path: { id: string }
      signal?: AbortSignal
      body: {
        agent: string
        parts: Array<{ type: 'text', text: string }>
        // Skill names ride the prompt body so the harness loads them natively;
        // the adapter turns them into SDK skill attachments.
        skills?: string[]
        model?: { providerID: string, modelID: string }
      }
    }): Promise<{ data?: { info?: { error?: unknown }, parts?: Array<{ type?: string, text?: string }> } }>
    messages?(input: {
      path: { id: string }
    }): Promise<{ data?: WorkflowSessionMessage[] }>
    abort?(input: { path: { id: string } }): Promise<unknown>
  }
  // Transient TUI toast channel (v1 SDK). Optional: a client without a TUI must
  // not prevent a run from completing.
  tui?: {
    showToast?(input: { body: ToastInput }): Promise<unknown>
  }
}

type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastInput {
  title?: string
  message: string
  variant: ToastVariant
  duration?: number
}

export type SubtaskStatus = 'ok' | 'error' | 'empty' | 'timeout' | 'aborted'

export interface SubtaskParameters {
  prompt: string
  description?: string
  agent?: string
  skills?: string[]
  task_id?: string
  fork_from?: string
  label?: string
  timeout_minutes?: number
  schema?: Record<string, unknown>
}

export type SubtaskInput = string | SubtaskParameters

export interface SubtaskResult {
  outputText: string
  task_id: string
  forked_from?: string
  label?: string
  status: SubtaskStatus
  error?: string
  durationMs: number
  data?: unknown
}

export interface StepRecord {
  description: string
  task_id: string
  status: SubtaskStatus
  durationMs: number
  error?: string
}

export interface WorkflowContext {
  client: WorkflowSdkClient
  parentSessionID: string
  directory?: string
  signal: AbortSignal
  defaultAgent: string
  maxSubtasks: number
  budget: { used: number }
  steps: StepRecord[]
  logs: string[]
  active: Set<AbortController>
  // Run start timestamp, backfilled by `createSubtask`. Optional so callers can
  // build a context literal.
  startedAt?: number
}

export type LogFunction = (message: unknown) => void

export type SubtaskFunction = (input: SubtaskInput) => Promise<SubtaskResult>

export interface WorkflowHelpers {
  subtask: SubtaskFunction
  log: LogFunction
}

export const DEFAULT_TIMEOUT_MINUTES = 90
export const DEFAULT_PER_SUBTASK_TIMEOUT_MINUTES = 15
export const DEFAULT_SUBTASK_AGENT = 'rug-swe'
export const DEFAULT_MAX_SUBTASKS = 32
export const MAX_MAX_SUBTASKS_CAP = 64
export const MAX_LOGS = 100
export const MAX_LOG_CHARS = 500
export const MAX_DESCRIPTION_CHARS = 80

export interface LsEntry {
  description: string
  durationMs: number
  task_id: string
  status: SubtaskStatus
  label?: string
}
