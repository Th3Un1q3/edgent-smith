import { randomBytes } from 'node:crypto'

// Per-run correlation id. Generated once at the run boundary and threaded
// through the context so concurrent runs stay distinguishable in toasts and
// child-session titles. Six lowercase hex chars keep it short but collision-safe
// for the handful of runs a session sees.
export const createRunId = (): string => `wf#${randomBytes(3).toString('hex')}`

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
    fork?(input: {
      path: { id: string }
      body?: { messageID?: string }
    }): Promise<{ data?: { id?: string } }>
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
    // v1 SDK shape: the session id travels as `path.id`. Optional so callers and
    // minimal test doubles can omit it; every call site guards before use.
    update?(input: {
      path: { id: string }
      body: { title: string }
    }): Promise<unknown>
  }
  // Transient TUI toast channel (v1 SDK). Optional: a client without a TUI must
  // not prevent a run from completing.
  tui?: {
    showToast?(input: { body: ToastInput }): Promise<unknown>
  }
}

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastInput {
  title?: string
  message: string
  variant: ToastVariant
  duration?: number
}

// Fire-and-forget toast sink; implementations must swallow their own failures.
export type NotifyFunction = (toast: ToastInput) => void

export type SubtaskStatus = 'ok' | 'error' | 'empty' | 'timeout' | 'aborted'

export interface SubtaskParameters {
  prompt: string
  description?: string
  agent?: string
  skills?: string[]
  task_id?: string
  fork_from?: string
  timeout_seconds?: number
  schema?: Record<string, unknown>
}

export type SubtaskInput = string | SubtaskParameters

export interface SubtaskResult {
  outputText: string
  task_id: string
  forked_from?: string
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
  // Child controller → step label for the subtasks currently in flight. Kept
  // optional so callers may build a context literal; `createContext` always
  // initializes it and `createSubtask` backfills it for direct construction.
  running?: Map<AbortController, string>
  // Run start timestamp, backfilled by `createSubtask`. Optional so callers can
  // build a context literal.
  startedAt?: number
  // Per-run correlation id (see `createRunId`). The runner generates it once and
  // threads it here; `createSubtask` backfills it for directly constructed
  // contexts. Optional so callers can build a context literal.
  runId?: string
  // Toast sink threaded from the runner's captured `client`. Optional so a
  // directly constructed context needs no notifications channel.
  notify?: NotifyFunction
}

export type LogFunction = (message: unknown) => void

export type SubtaskFunction = (input: SubtaskInput) => Promise<SubtaskResult>

export interface WorkflowHelpers {
  subtask: SubtaskFunction
  log: LogFunction
}

export const DEFAULT_TIMEOUT_SECONDS = 600
export const DEFAULT_PER_SUBTASK_TIMEOUT_SECONDS = 300
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
