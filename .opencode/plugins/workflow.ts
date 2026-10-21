/**
 * workflow — OpenCode v2 Effect plugin (migrated).
 *
 * V1 returned a `tool` map; V2 registers custom tools through
 * `ctx.tool.transform(editor => editor.add({ ... }))` with a JSON-Schema input.
 * The runner is reused through a client adapter over `ctx.session`
 * (see helpers/workflow-client-adapter.ts).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { Cause, Effect, Stream } from 'effect'
import type { Context, Plugin } from '@opencode/plugin/effect/plugin'
import { harnessConfig } from './config/harness.config'
import { listSteps, readStoredSteps } from './helpers/subtask-ls'
import { runStandaloneSubtask } from './helpers/subtask-run'
import { recordTailOutput, tailOutputs } from './helpers/subtask-tail'
import { createWorkflowClient } from './helpers/workflow-client-adapter'
import { writeEntry, removeEntry, entryValueBytes, MAX_ENTRY_VALUE_BYTES } from './helpers/instruction-entry-client'
import type { EntryResult } from './helpers/instruction-entry-client'

const WORKFLOW_INSTRUCTIONS_SENTINEL = '<workflow_instructions'
const WORKFLOW_INSTRUCTIONS_CLOSING = '</workflow_instructions>'

// The sentinel is the strip key for a previously injected block, so it stays a
// prefix of the rendered opening tag whatever attributes that tag carries.
// Exported as a binding (not a declaration) so the plugin-export-guard rule does
// not reject the entry file; tests need the sentinel to assert the injected block.
export { WORKFLOW_INSTRUCTIONS_SENTINEL }

const SUBTASK_LS_TOOL_NAME = 'subtask_ls'
const SUBTASK_RUN_TOOL_NAME = 'subtask_run'
const SUBTASK_TAIL_TOOL_NAME = 'subtask_tail'
const WORKFLOW_CONFIG_KEY = 'workflow'
// Server namespaces entry keys as api/<key>; the key must match ^[a-z0-9][a-z0-9._-]*$.
const WORKFLOW_ENTRY_KEY = 'workflow.instructions'

const describeCause = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

type PluginEvent = Stream.Success<ReturnType<Context['event']['subscribe']>>

export type WorkflowSessionEventType = 'session.created' | 'session.agent.selected'

export interface WorkflowSessionEventView {
  readonly type: string
  readonly data: { readonly sessionID: unknown, readonly agent?: unknown }
}

export interface WorkflowInstructions {
  readonly source: string
  readonly content: string
}

export interface WorkflowSessionHandlerOptions {
  readonly agentAllowlist: ReadonlySet<string>
  readonly block: string
  readonly entryBytes: number
}

export const isWorkflowSessionEvent = (event: { readonly type: string }, type: WorkflowSessionEventType): boolean =>
  event.type === type

const isSessionCreated = (event: PluginEvent): event is Extract<PluginEvent, { type: 'session.created' }> =>
  isWorkflowSessionEvent(event, 'session.created')

const isSessionAgentSelected = (event: PluginEvent): event is Extract<PluginEvent, { type: 'session.agent.selected' }> =>
  isWorkflowSessionEvent(event, 'session.agent.selected')

const workflowInstructionsError = (target: string, cause: string): Error =>
  new Error(`workflow instructions: ${target}: ${cause}`)

const configuredInstructionsPath = (): string => {
  const section = (harnessConfig.plugins as { workflow?: { instructions?: unknown } }).workflow
  const configured = section?.instructions
  if (typeof configured !== 'string' || configured.trim() === '') {
    throw workflowInstructionsError(
      `harnessConfig.plugins["${WORKFLOW_CONFIG_KEY}"].instructions`,
      'missing or not a non-empty string',
    )
  }
  return configured
}

const configuredAgentAllowlist = (): string[] => {
  const section = (harnessConfig.plugins as { workflow?: { agents?: unknown } }).workflow
  const configured = section?.agents
  if (!Array.isArray(configured) || configured.length === 0 || configured.some(agent => typeof agent !== 'string' || agent.trim() === '')) {
    throw workflowInstructionsError(
      `harnessConfig.plugins["${WORKFLOW_CONFIG_KEY}"].agents`,
      'missing or not a non-empty string array',
    )
  }
  return configured
}

const resolveInstructionsPath = (directory: string, configured: string): string => {
  try {
    if (typeof directory !== 'string' || directory.trim() === '') {
      throw new Error('project directory is missing')
    }
    return path.resolve(directory, configured)
  }
  catch (error) {
    throw workflowInstructionsError(`cannot resolve ${configured} against ${directory}`, describeCause(error))
  }
}

const assertInstructionContent = (content: string, label: string): void => {
  if (content.trim() === '') throw workflowInstructionsError(label, 'file is empty or whitespace')
  if (content.includes('\0')) throw workflowInstructionsError(label, 'file contains a NUL byte')
  if (content.includes('\u{FFFD}')) throw workflowInstructionsError(label, 'file contains U+FFFD (invalid UTF-8)')
}

/**
 * Resolves `harnessConfig.plugins["workflow"].instructions` against `directory`
 * and reads it once as UTF-8. Returns the resolved path beside the verbatim
 * content so the container can name its source. Throws with the configured path
 * in the message on any problem — callers surface the failure instead of
 * falling back.
 */
export function loadWorkflowInstructions(directory: string): WorkflowInstructions {
  const configured = configuredInstructionsPath()
  const resolved = resolveInstructionsPath(directory, configured)

  let content: string
  try {
    content = readFileSync(resolved, 'utf8')
  }
  catch (error) {
    throw workflowInstructionsError(`cannot read ${resolved} (configured as ${configured})`, describeCause(error))
  }

  assertInstructionContent(content, `${resolved} (configured as ${configured})`)
  return { source: resolved, content }
}

// The configured path reaches the model as an attribute value, so a quote or an
// angle bracket in it must not end the attribute and break the block.
const escapeAttribute = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')

const formatWorkflowInstructions = (source: string, content: string): string =>
  `${WORKFLOW_INSTRUCTIONS_SENTINEL} source="${escapeAttribute(source)}" version="1">\n${content}\n${WORKFLOW_INSTRUCTIONS_CLOSING}`

const utf8Bytes = (value: string): number => new TextEncoder().encode(value).byteLength

// The entry client names the outcome of an action; only `failed` carries a
// cause worth surfacing, so `unchanged` and `absent` stay quiet.
const reportEntryFailure = (action: string, result: EntryResult): Effect.Effect<void> =>
  result.status === 'failed'
    ? Effect.logError('workflow.instructions.error', { message: `workflow instructions: ${action} failed: ${result.error ?? 'unknown error'}` })
    : Effect.void

export const handleSessionEvent = (
  event: WorkflowSessionEventView,
  options: WorkflowSessionHandlerOptions,
): Effect.Effect<void> => Effect.gen(function* () {
  const sessionID = event.data.sessionID as unknown as string
  const agent = event.data.agent as string | undefined

  if (agent === undefined) {
    yield* Effect.logInfo('workflow.instructions.skipped', { sessionID, agent: 'unknown' })
    return
  }

  if (!options.agentAllowlist.has(agent)) {
    const removal = yield* Effect.promise(() => removeEntry(sessionID, WORKFLOW_ENTRY_KEY))
    yield* Effect.logInfo('workflow.instructions.skipped', { sessionID, agent, status: removal.status })
    yield* reportEntryFailure('remove', removal)
    return
  }

  if (options.entryBytes > MAX_ENTRY_VALUE_BYTES) {
    yield* Effect.logInfo('workflow.instructions.skipped', { sessionID, agent, reason: 'entry-too-large', entryBytes: options.entryBytes })
    return
  }

  const write = yield* Effect.promise(() => writeEntry(sessionID, WORKFLOW_ENTRY_KEY, options.block))
  yield* Effect.logInfo('workflow.instructions', { sessionID, agent, status: write.status, entryBytes: options.entryBytes })
  yield* reportEntryFailure('write', write)
}).pipe(
  // The subscription contract is Effect<void, never>, so surface failures
  // as a log line instead of a silent defect; the session keeps running.
  Effect.catchCause(cause =>
    Effect.logError('workflow.instructions.error', { message: describeCause(Cause.squash(cause)) }),
  ),
)

// ADR-012: workflow tool retired. Standalone trio (subtask_ls, subtask_run,
// subtask_tail) is the only execution surface; no script wrapper remains.
const SUBTASK_LS_TOOL_DESCRIPTION = [
  'List subtasks from the latest finished workflow run in this server process.',
  'Returns an array of {description, durationMs, task_id, status}.',
  'A restart clears the snapshot, so an empty array means no run yet.',
].join(' ')

const SUBTASK_LS_INPUT = {
  type: 'object',
  properties: {
    count: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Maximum rows to return (default 10, capped at 50).' },
    status: { type: 'string', enum: ['ok', 'error', 'empty', 'timeout', 'aborted'], description: 'Return only subtasks with this status.' },
  },
  additionalProperties: false,
}

interface SubtaskLsArguments {
  count?: number
  status?: 'ok' | 'error' | 'empty' | 'timeout' | 'aborted'
}

const SUBTASK_RUN_TOOL_DESCRIPTION = [
  'Run a single subtask directly without a workflow script.',
  'Accepts description and prompt plus the standard subtask passthrough',
  '(task_id, fork_from, agent, skills, timeout_minutes, schema).',
  'Returns the subtask result JSON with status and output.',
].join(' ')

const SUBTASK_RUN_INPUT = {
  type: 'object',
  properties: {
    prompt: { type: 'string', minLength: 1, description: 'Subtask prompt; what the child should do.' },
    description: { type: 'string', minLength: 1, description: 'One-line indication of what the subtask does.' },
    agent: { type: 'string', description: 'Override the child agent (default rug-swe).' },
    skills: { type: 'array', items: { type: 'string' }, description: 'Skill names loaded into the child prompt.' },
    task_id: { type: 'string', description: 'Continue/resume an existing child session.' },
    fork_from: { type: 'string', description: 'Fork a session and run the child there.' },
    timeout_minutes: { type: 'number', description: 'Per-subtask timeout in minutes (default 15).' },
    schema: { type: 'object', description: 'JSON Schema for a structured <result_json> reply.' },
  },
  required: ['prompt', 'description'],
  additionalProperties: false,
}

interface SubtaskRunArguments {
  prompt: string
  description: string
  agent?: string
  skills?: string[]
  task_id?: string
  fork_from?: string
  timeout_minutes?: number
  schema?: Record<string, unknown>
}

const SUBTASK_TAIL_TOOL_DESCRIPTION = [
  'Return the last outputs recorded for a subtask id.',
  'Returns an array of {task_id, outputText, status, truncated, updated_at}.',
  'An unknown or expired id returns an empty array.',
].join(' ')

const SUBTASK_TAIL_INPUT = {
  type: 'object',
  properties: {
    task_id: { type: 'string', minLength: 1, description: 'Subtask id to tail; matches the task_id returned by subtask_run.' },
    id: { type: 'string', minLength: 1, description: 'Alias for task_id.' },
    count: { type: 'integer', minimum: 1, maximum: 5, default: 3, description: 'Maximum outputs to return (default 3, capped at 5).' },
  },
  additionalProperties: false,
}

interface SubtaskTailArguments {
  task_id?: string
  id?: string
  count?: number
}

const plugin: Plugin = {
  id: 'opencode.workflow',
  effect: context => Effect.gen(function* () {
    const directory = context.location.directory as unknown as string
    // Read once per plugin lifetime; a change requires a restart.
    const loaded = yield* Effect.try({
      try: () => loadWorkflowInstructions(directory),
      catch: cause => cause instanceof Error ? cause : new Error(String(cause)),
    }).pipe(Effect.orDie)

    const configuredPath = configuredInstructionsPath()
    yield* Effect.logInfo('workflow.instructions.loaded', {
      path: configuredPath,
      resolvedPath: loaded.source,
      contentBytes: utf8Bytes(loaded.content),
      agents: [...configuredAgentAllowlist()],
    })

    // ADR-011: instructions travel as a session instruction entry. Session
    // creation and agent selection are the only moments the owning agent is
    // known or changes; there is no system-prompt carrier and no fallback.
    const agentAllowlist = new Set(configuredAgentAllowlist())
    const block = formatWorkflowInstructions(loaded.source, loaded.content)
    const entryBytes = entryValueBytes(block)
    const handlerOptions: WorkflowSessionHandlerOptions = { agentAllowlist, block, entryBytes }

    yield* context.event.subscribe().pipe(
      Stream.filter(isSessionCreated),
      Stream.runForEach(event => handleSessionEvent(event, handlerOptions)),
      Effect.forkScoped,
    )
    yield* context.event.subscribe().pipe(
      Stream.filter(isSessionAgentSelected),
      Stream.runForEach(event => handleSessionEvent(event, handlerOptions)),
      Effect.forkScoped,
    )

    let lsRegistrationError: unknown
    yield* context.tool.transform((editor) => {
      try {
        editor.add({
          name: SUBTASK_LS_TOOL_NAME,
          description: SUBTASK_LS_TOOL_DESCRIPTION,
          input: SUBTASK_LS_INPUT,
          execute: input => Effect.gen(function* () {
            const arguments_ = input as SubtaskLsArguments
            const entries = listSteps(readStoredSteps(), { count: arguments_.count, status: arguments_.status })
            const content = JSON.stringify(entries)
            return { content, metadata: { title: `subtask_ls: ${entries.length} subtask(s)` } }
          }),
        })
        editor.add({
          name: SUBTASK_RUN_TOOL_NAME,
          description: SUBTASK_RUN_TOOL_DESCRIPTION,
          input: SUBTASK_RUN_INPUT,
          execute: (input, toolContext) => Effect.gen(function* () {
            const arguments_ = input as SubtaskRunArguments
            const result = yield* Effect.promise(() => runStandaloneSubtask(
              {
                client: createWorkflowClient(context.session),
                parentSessionID: toolContext.sessionID as unknown as string,
                directory: context.location.directory as unknown as string,
              },
              {
                prompt: arguments_.prompt,
                description: arguments_.description,
                agent: arguments_.agent,
                skills: arguments_.skills,
                task_id: arguments_.task_id,
                fork_from: arguments_.fork_from,
                timeout_minutes: arguments_.timeout_minutes,
                schema: arguments_.schema,
              },
            ))
            recordTailOutput(result)
            return { content: JSON.stringify(result), metadata: { title: `subtask_run: ${result.status}` } }
          }),
        })
        editor.add({
          name: SUBTASK_TAIL_TOOL_NAME,
          description: SUBTASK_TAIL_TOOL_DESCRIPTION,
          input: SUBTASK_TAIL_INPUT,
          execute: input => Effect.gen(function* () {
            const arguments_ = input as SubtaskTailArguments
            const taskId = arguments_.task_id ?? arguments_.id ?? ''
            const entries = taskId === '' ? [] : tailOutputs(taskId, { count: arguments_.count })
            const content = JSON.stringify(entries)
            return { content, metadata: { title: `subtask_tail: ${entries.length} output(s)` } }
          }),
        })
      }
      catch (error) {
        lsRegistrationError = error
      }
    })
    if (lsRegistrationError !== undefined) {
      yield* Effect.logError('subtask_ls.register.failed', { message: describeCause(lsRegistrationError) })
    }
  }),
}

export default plugin
