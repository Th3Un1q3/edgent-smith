import { Effect } from 'effect'
import { getClient } from '../helpers/runtime/service-client'
import { clampCount } from './subtask-ls'

export const DEFAULT_OUTPUTS_COUNT = 3
export const MAX_OUTPUTS_COUNT = 5

export interface OutputEntry {
  task_id: string
  outputText: string
  sent_at: string
  status: 'ok' | 'error'
}

export interface SubtaskOutputsResult {
  entries: OutputEntry[]
  total_messages: number
}

export interface MessageLister {
  list?: (input: unknown) => unknown
}

// Stand-in for the client's MessageListInput: this module never imports the
// client package, so only the fields the lister reads are named here.
interface ListInput {
  sessionID: string
  type: 'assistant'
  order: 'desc'
  limit: number
}

interface OutputsArguments {
  task_id?: string
  count?: number
}

const ERROR_FINISHES: ReadonlySet<unknown> = new Set(['error', 'content-filter'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const asRecords = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? (value as unknown[]).filter(isRecord) : []

const messageRecords = (value: unknown): Array<Record<string, unknown>> =>
  asRecords(isRecord(value) ? value.data : value)

const isAssistant = (message: Record<string, unknown>): boolean => message.type === 'assistant'

const isTextPart = (part: unknown): part is { text: string } =>
  isRecord(part) && part.type === 'text' && typeof part.text === 'string'

const textOf = (content: unknown): string =>
  asRecords(content).filter(isTextPart).map(part => part.text).filter(text => text !== '').join('\n')

const createdMs = (message: Record<string, unknown>): number => {
  const time = message.time
  if (!isRecord(time)) return 0
  return typeof time.created === 'number' ? time.created : 0
}

// SessionMessageAssistant carries no status field: a carried error or a
// filtered/error finish is the only failure signal the message exposes.
const hasError = (message: Record<string, unknown>): boolean =>
  message.error !== undefined || ERROR_FINISHES.has(message.finish)

const statusOf = (message: Record<string, unknown>): 'ok' | 'error' => (hasError(message) ? 'error' : 'ok')

const toEntry = (taskId: string, message: Record<string, unknown>): OutputEntry => ({
  task_id: taskId,
  outputText: textOf(message.content),
  sent_at: new Date(createdMs(message)).toISOString(),
  status: statusOf(message),
})

const emptyResult = (): SubtaskOutputsResult => ({ entries: [], total_messages: 0 })

const pageInput = (taskId: string): ListInput => ({
  sessionID: taskId,
  type: 'assistant',
  order: 'desc',
  limit: MAX_OUTPUTS_COUNT,
})

const readPage = async (lister: MessageLister, taskId: string): Promise<Array<Record<string, unknown>>> => {
  const list = lister.list
  return typeof list === 'function' ? messageRecords(await list.call(lister, pageInput(taskId))) : []
}

const collect = (
  taskId: string,
  page: Array<Record<string, unknown>>,
  count: number | undefined,
): SubtaskOutputsResult => {
  const wanted = clampCount(count, MAX_OUTPUTS_COUNT, DEFAULT_OUTPUTS_COUNT)
  const messages = page.filter(message => isAssistant(message)).sort((left, right) => createdMs(left) - createdMs(right))
  return {
    entries: messages.slice(-wanted).map(message => toEntry(taskId, message)),
    total_messages: messages.length,
  }
}

const resolveId = (taskId: string | undefined): string => (taskId === undefined ? '' : taskId)

const readOrEmpty = async (
  lister: MessageLister,
  id: string,
  count: number | undefined,
): Promise<SubtaskOutputsResult> => {
  try {
    return collect(id, await readPage(lister, id), count)
  }
  catch {
    return emptyResult()
  }
}

export const readSubtaskOutputs = async (
  lister: MessageLister,
  taskId: string | undefined,
  options: { count?: number } = {},
): Promise<SubtaskOutputsResult> => {
  const id = resolveId(taskId)
  return id.trim() === '' ? emptyResult() : readOrEmpty(lister, id, options.count)
}

const runOutputs = async (
  directory: string,
  taskId: string | undefined,
  count: number | undefined,
): Promise<SubtaskOutputsResult> => {
  try {
    const client = await getClient(undefined, directory)
    const lister: MessageLister = { list: input => client.message.list(input as ListInput) }
    return await readSubtaskOutputs(lister, taskId, { count })
  }
  catch {
    return emptyResult()
  }
}

const SUBTASK_OUTPUTS_TOOL_DESCRIPTION = [
  'Read the latest assistant outputs of a subtask from its session through the client API.',
  'Returns {task_id, outputText, sent_at, status}[].',
  'An unknown or empty id returns an empty array.',
].join(' ')

const SUBTASK_OUTPUTS_INPUT = {
  type: 'object',
  properties: {
    task_id: { type: 'string', minLength: 1, description: 'Subtask id from subtask_run.' },
    count: { type: 'integer', minimum: 1, maximum: 5, default: 3, description: 'Max outputs (default 3, max 5).' },
  },
  additionalProperties: false,
}

export const subtaskOutputsTool = (directory: string) => ({
  name: 'subtask_outputs',
  description: SUBTASK_OUTPUTS_TOOL_DESCRIPTION,
  input: SUBTASK_OUTPUTS_INPUT,
  execute: (input: unknown) => Effect.promise(async () => {
    const arguments_ = input as OutputsArguments
    const result = await runOutputs(directory, arguments_.task_id, arguments_.count)
    return {
      content: JSON.stringify(result.entries),
      metadata: {
        title: `subtask_outputs: ${result.entries.length} output(s)`,
        total_messages: result.total_messages,
      },
    }
  }),
})
