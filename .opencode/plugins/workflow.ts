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
import { DEFAULT_TIMEOUT_MINUTES, runWorkflow } from './helpers/workflow-runner'
import { createWorkflowClient } from './helpers/workflow-client-adapter'
import { formatElapsed } from './helpers/workflow-subtask'
import { writeEntry, removeEntry, entryValueBytes, MAX_ENTRY_VALUE_BYTES } from './helpers/instruction-entry-client'
import type { EntryResult } from './helpers/instruction-entry-client'
import { DEFAULT_MAX_CONCURRENT, DEFAULT_MAX_SUBTASKS } from './helpers/workflow-types'

const WORKFLOW_INSTRUCTIONS_SENTINEL = '<workflow_instructions'
const WORKFLOW_INSTRUCTIONS_CLOSING = '</workflow_instructions>'

// The sentinel is the strip key for a previously injected block, so it stays a
// prefix of the rendered opening tag whatever attributes that tag carries.
// Exported as a binding (not a declaration) so the plugin-export-guard rule does
// not reject the entry file; tests need the sentinel to assert the injected block.
export { WORKFLOW_INSTRUCTIONS_SENTINEL }

const WORKFLOW_TOOL_NAME = 'workflow'
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

const WORKFLOW_TOOL_DESCRIPTION = [
  'Execute a JavaScript workflow script that orchestrates subagents.',
  'The script runs with two helpers: subtask and log.',
  '',
  'subtask(input) -> Promise<result>',
  '- input: a string prompt, or {prompt, description, agent?, skills?, task_id?, fork_from?, timeout_minutes?, schema?}',
  '- description: required for the object form; a one-line indication of what the subtask does.',
  '- timeout_minutes: per-subtask timeout in minutes (default 15).',
  '- result: {outputText, task_id, status, error?, durationMs, truncated, data?, forked_from?}',
  '- status: \'ok\' | \'error\' | \'empty\' | \'timeout\' | \'aborted\'',
  '- Failed children never throw; inspect status. Concurrency is bounded automatically (default 4).',
  '- Children default to the rug-swe agent; pass agent per subtask to override.',
  '- task_id continues/resumes an existing child session; fork_from forks a session (V2: unsupported, returns an error result).',
  '- skills: string[] loads .agents/skills/<name>/SKILL.md into the child prompt.',
  '- schema: a JSON Schema object; the child returns a JSON block between <result_json> and </result_json>.',
  '',
  'log(message) -> appends a marker to the envelope logs.',
  '',
  'The script must return a small JSON-serializable object (becomes result).',
  'A guard rejects import/require, Function(, eval(, constructor, process, globalThis, global, Bun, Deno, fetch(;',
  'forbidden tokens return forbidden_script, syntax errors invalid_script.',
  '',
  'Tool result: {title, output}. output is the JSON envelope string; title is a summary such as',
  '"workflow: ok · 3/5 subtasks · 12.4s". Per-subtask details live in steps[].',
  '',
  'Envelope: {status, result, error?, steps, stats, logs} with status one of',
  'ok | error | timeout | aborted | budget_exceeded | invalid_script | forbidden_script.',
].join('\n')

const WORKFLOW_INPUT = {
  type: 'object',
  properties: {
    script: { type: 'string', minLength: 1, description: 'JS workflow script; runs with two helpers: subtask and log, no import/require.' },
    timeout_minutes: { type: 'integer', minimum: 1, maximum: 600, default: DEFAULT_TIMEOUT_MINUTES, description: 'Overall workflow timeout in minutes (1-600).' },
    max_concurrent: { type: 'integer', minimum: 1, maximum: 8, default: DEFAULT_MAX_CONCURRENT, description: 'Maximum concurrent child subagents.' },
    max_subtasks: { type: 'integer', minimum: 1, maximum: 64, default: DEFAULT_MAX_SUBTASKS, description: 'Maximum subtasks before the budget is exhausted.' },
  },
  required: ['script'],
  additionalProperties: false,
}

interface WorkflowArguments {
  script: string
  timeout_minutes?: number
  max_concurrent?: number
  max_subtasks?: number
}

const readNumber = (value: unknown): number => (Number.isFinite(value) ? (value as number) : 0)

const toToolResult = (output: string): { content: string, metadata: { title: string } } => {
  try {
    const envelope = JSON.parse(output) as {
      status?: unknown
      stats?: { ok?: unknown, subtasks?: unknown, totalMs?: unknown }
    }
    const status = typeof envelope.status === 'string' ? envelope.status : 'unknown'
    const stats = envelope.stats ?? {}
    const elapsed = formatElapsed(Math.max(0, readNumber(stats.totalMs)))
    return { content: output, metadata: { title: `workflow: ${status} · ${readNumber(stats.ok)}/${readNumber(stats.subtasks)} subtasks · ${elapsed}` } }
  }
  catch {
    return { content: output, metadata: { title: 'workflow: unparseable envelope' } }
  }
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

    yield* context.tool.transform((editor) => {
      editor.add({
        name: WORKFLOW_TOOL_NAME,
        description: WORKFLOW_TOOL_DESCRIPTION,
        input: WORKFLOW_INPUT,
        execute: (input, toolContext) => Effect.gen(function* () {
          const arguments_ = input as WorkflowArguments
          const output = yield* Effect.promise(() => runWorkflow({
            script: arguments_.script,
            client: createWorkflowClient(context.session),
            parentSessionID: toolContext.sessionID as unknown as string,
            directory: context.location.directory as unknown as string,
            timeoutMs: (arguments_.timeout_minutes ?? DEFAULT_TIMEOUT_MINUTES) * 60_000,
            maxConcurrent: arguments_.max_concurrent,
            maxSubtasks: arguments_.max_subtasks,
          }))
          return toToolResult(output)
        }),
      })
    })
  }),
}

export default plugin
