import { turnError } from './subtask-classify'
import { toErrorMessage } from './subtask-log'
import { extractOutputText, parseStructured } from './subtask-structured'
import type { NormalizedSubtaskParameters } from './subtask-parameters'
import type { ParsedStructured } from './subtask-structured'
import type { ParentModel } from './subtask-model'
import type { SubtaskParameters, WorkflowContext, WorkflowSdkClient } from './contracts'

// Absent or empty ids leave the body exactly as a skill-less call, so no key
// reaches the SDK and the adapter's own omission stays the only guard.
const skillField = (skills: string[] | undefined): { skills?: string[] } =>
  skills === undefined || skills.length === 0 ? {} : { skills }

const buildPromptBody = (
  parameters: SubtaskParameters,
  text: string,
  defaultAgent: string,
  skills: string[] | undefined,
  model?: ParentModel,
): {
  agent: string
  parts: Array<{ type: 'text', text: string }>
  skills?: string[]
  model?: ParentModel
} => {
  const body: {
    agent: string
    parts: Array<{ type: 'text', text: string }>
    skills?: string[]
    model?: ParentModel
  } = {
    agent: parameters.agent ?? defaultAgent,
    parts: [{ type: 'text', text }],
    ...skillField(skills),
  }
  return model === undefined ? body : { ...body, model }
}

export interface PromptResponse {
  data?: { info?: { error?: unknown }, parts?: Array<{ type?: string, text?: string }> }
}

interface TurnOutcome {
  response: PromptResponse
  parsed?: ParsedStructured
}

const SCHEMA_INSTRUCTION
  = 'Return your complete answer. You MAY include free-form prose, analysis, and code outside the tags. '
    + 'You MUST include exactly one structured block delimited by <result_json> and </result_json>. '
    + 'Between the tags put ONLY a single JSON value conforming to the JSON Schema below — '
    + 'no markdown fence, no prose, no trailing text inside the tags.'
const SCHEMA_RETRY_INSTRUCTION
  = 'Your previous reply did not contain a usable <result_json> block. '
    + 'Repeat your answer, keep any prose you still need, and end with exactly one '
    + '<result_json> ... </result_json> block containing ONLY valid JSON conforming to the JSON Schema below. '
    + 'No markdown fence inside the tags.'

const schemaBlock = (instruction: string, schema: Record<string, unknown>): string =>
  `${instruction}\n<response_schema>\n${JSON.stringify(schema)}\n</response_schema>`

const promptOnce = (
  context: WorkflowContext,
  sessionID: string,
  child: AbortController,
  parameters: SubtaskParameters,
  text: string,
  skills: string[] | undefined,
  model: ParentModel | undefined,
): Promise<PromptResponse> =>
  context.client.session.prompt({
    path: { id: sessionID },
    signal: child.signal,
    body: buildPromptBody(parameters, text, context.defaultAgent, skills, model),
  })

const isUnusableOutput = (response: PromptResponse, parsed: ParsedStructured): boolean =>
  parsed.usable === false
  && !turnError(response)
  && extractOutputText(response.data).trim() !== ''

const shouldRetryStructured = (
  response: PromptResponse,
  parsed: ParsedStructured,
  isTimedOut: boolean,
  isParentAborted: boolean,
): boolean => !isTimedOut && !isParentAborted && isUnusableOutput(response, parsed)

// Runs the prompt once (or twice for an unusable structured reply) on the same
// session. The caller owns the per-attempt timer/abort, which covers both turns.
export const runTurn = async (
  context: WorkflowContext,
  sessionID: string,
  child: AbortController,
  parameters: SubtaskParameters,
  basePrompt: string,
  skills: string[] | undefined,
  model: ParentModel | undefined,
  isTimedOut: () => boolean,
): Promise<TurnOutcome> => {
  const { schema } = parameters
  if (schema === undefined) {
    return { response: await promptOnce(context, sessionID, child, parameters, basePrompt, skills, model) }
  }
  const text = `${basePrompt}\n\n${schemaBlock(SCHEMA_INSTRUCTION, schema)}`
  const response = await promptOnce(context, sessionID, child, parameters, text, skills, model)
  const parsed = parseStructured(extractOutputText(response.data), schema)
  if (!shouldRetryStructured(response, parsed, isTimedOut(), context.signal.aborted)) {
    return { response, parsed }
  }
  // The retry rides the first prompt's message, so the session already holds the
  // skill content; the host renders one <skill_content> per attachment on every
  // prompt, so re-sending the ids here would duplicate that text in the child.
  const retry = await promptOnce(context, sessionID, child, parameters, schemaBlock(SCHEMA_RETRY_INSTRUCTION, schema), undefined, model)
  return { response: retry, parsed: parseStructured(extractOutputText(retry.data), schema) }
}

export interface ResolvedSession {
  sessionID: string
  forkedFrom?: string
}

// `client.session.fork` must be invoked on its receiver: the generated SDK
// method relies on `this`, so extracting it into a bare const detaches the
// receiver and throws. The unsupported check narrows the optional method.
//
// The call argument is exactly `{ sessionID: sourceID }`, the v2
// `SessionForkInput` from `@opencode/client` (`{ sessionID, before? }`) minus
// the optional boundary. With no `before` the server forks at the session's
// latest message, which is the "continue this conversation" semantics a subtask
// wants, and the caller only ever has a session id. This exact argument object
// is pinned by the fork tests.
const callFork = async (
  client: WorkflowSdkClient,
  sourceID: string,
): Promise<{ data?: { id?: string } }> => {
  if (client.session.fork === undefined) {
    throw new Error(`failed to fork subtask session ${sourceID}: session.fork is unsupported`)
  }
  try {
    return await client.session.fork({ sessionID: sourceID })
  }
  catch (error) {
    throw new Error(`failed to fork subtask session ${sourceID}: ${toErrorMessage(error)}`)
  }
}

const isMissingSessionID = (value: string | undefined): value is '' | undefined => value === undefined || value === ''

const forkSession = async (client: WorkflowSdkClient, sourceID: string): Promise<string> => {
  const forked = await callFork(client, sourceID)
  const forkedID = forked.data?.id
  if (isMissingSessionID(forkedID)) {
    throw new Error(`failed to fork subtask session ${sourceID}: no session id returned`)
  }
  return forkedID
}

// `session.create` requires a title, so the description seeds a brand-new
// session. A forked session gets no seed, so it never surfaces the source
// session's title.
export const resolveSessionID = async (
  client: WorkflowSdkClient,
  parameters: NormalizedSubtaskParameters,
  parentSessionID: string,
): Promise<ResolvedSession> => {
  if (parameters.task_id !== undefined) {
    return { sessionID: parameters.task_id }
  }
  return parameters.fork_from === undefined
    ? { sessionID: await createSession(client, parameters, parentSessionID) }
    : { sessionID: await forkSession(client, parameters.fork_from), forkedFrom: parameters.fork_from }
}

const createSession = async (
  client: WorkflowSdkClient,
  parameters: NormalizedSubtaskParameters,
  parentSessionID: string,
): Promise<string> => {
  const created = await client.session.create({
    body: { title: parameters.description, parentID: parentSessionID },
  })
  return created.data?.id ?? ''
}
