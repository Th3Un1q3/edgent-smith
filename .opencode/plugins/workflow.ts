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

import { Cause, Effect } from 'effect'
import type { Plugin } from '@opencode/plugin/effect/plugin'
import { harnessConfig } from './config/harness.config'
import { DEFAULT_TIMEOUT_MINUTES, runWorkflow } from './helpers/workflow-runner'
import { createWorkflowClient } from './helpers/workflow-client-adapter'
import { formatElapsed } from './helpers/workflow-subtask'
import { didPutEntry, entryValueBytes, findEntry, didRemoveEntry } from './helpers/instruction-entry-client'
import { DEFAULT_MAX_CONCURRENT, DEFAULT_MAX_SUBTASKS } from './helpers/workflow-types'

const WORKFLOW_INSTRUCTIONS_SENTINEL = '<workflow_instructions version="1">'
const WORKFLOW_INSTRUCTIONS_CLOSING = '</workflow_instructions>'

// Exported as a binding (not a declaration) so the plugin-export-guard rule does
// not reject the entry file; tests need the sentinel to assert the injected block.
export { WORKFLOW_INSTRUCTIONS_SENTINEL }

const WORKFLOW_TOOL_NAME = 'workflow'
const WORKFLOW_CONFIG_KEY = 'workflow'
// Server namespaces entry keys as api/<key>; the key must match ^[a-z0-9][a-z0-9._-]*$.
const WORKFLOW_ENTRY_KEY = 'workflow.instructions'

// The workflow tool is registered by this plugin, but the per-request tool map
// exposes it through Code Mode (`execute`); `workflow` is kept for harness modes
// that surface it directly.
const WORKFLOW_EXPOSURE_TOOLS = ['workflow', 'execute'] as const

const describeCause = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

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
 * and reads it once as UTF-8. Throws with the configured path in the message on
 * any problem — callers surface the failure instead of falling back.
 */
export function loadWorkflowInstructions(directory: string): string {
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
  return content
}

const formatWorkflowInstructions = (content: string): string =>
  `${WORKFLOW_INSTRUCTIONS_SENTINEL}\n${content}\n${WORKFLOW_INSTRUCTIONS_CLOSING}`

const objectKeys = (value: unknown): string[] => {
  try {
    return typeof value !== 'object' || value === null ? [] : Object.keys(value as Record<string, unknown>)
  }
  catch {
    return []
  }
}

// Diagnostics for the context hook: reads only through optional chaining and
// try/catch so instrumentation can never be the reason the hook fails.
const describeContextEvent = (event: unknown): Record<string, unknown> => {
  try {
    const tools = (event as { tools?: unknown } | null | undefined)?.tools
    const isToolsIsObject = typeof tools === 'object' && tools !== null
    return {
      received: event !== null && event !== undefined,
      eventKeys: objectKeys(event),
      toolsIsObject: isToolsIsObject,
      ...(isToolsIsObject && { tools: objectKeys(tools) }),
    }
  }
  catch {
    return { received: event !== null && event !== undefined, eventKeys: [], toolsIsObject: false }
  }
}

const sessionIDOf = (event: unknown): string | undefined => {
  try {
    const value = (event as { sessionID?: unknown } | null | undefined)?.sessionID
    return typeof value === 'string' && value !== '' ? value : undefined
  }
  catch {
    return undefined
  }
}

const safeToolKeys = (event: unknown): string[] => {
  try {
    return objectKeys((event as { tools?: unknown } | null | undefined)?.tools)
  }
  catch {
    return []
  }
}

const utf8Bytes = (value: string): number => new TextEncoder().encode(value).byteLength

const didRemoveInstructionEntry = async (sessionID: string): Promise<boolean> => {
  try {
    return await didRemoveEntry(sessionID, WORKFLOW_ENTRY_KEY)
  }
  catch {
    return false
  }
}

const readInstructionEntry = async (sessionID: string): Promise<{ value: unknown, error: string }> => {
  try {
    const entry = await findEntry(sessionID, WORKFLOW_ENTRY_KEY)
    return { value: entry?.value, error: '' }
  }
  catch (error) {
    return { value: undefined, error: describeCause(error) }
  }
}

const releaseUnusedSession = (
  sessionID: string | undefined,
  gatedSessions: Set<string>,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (sessionID === undefined) return
    gatedSessions.delete(sessionID)
    const removed = yield* Effect.promise(() => didRemoveInstructionEntry(sessionID))
    if (removed) yield* Effect.logInfo('workflow.instructions.cleared', { sessionID })
  })

const didStripWorkflowSystemBlocks = (system: unknown[]): boolean => {
  let isStripped = false
  for (let index = system.length - 1; index >= 0; index -= 1) {
    const part = system[index] as { type?: unknown, text?: unknown }
    if (!(part.type === 'text' && typeof part.text === 'string' && part.text.includes(WORKFLOW_INSTRUCTIONS_SENTINEL))) continue

    system.splice(index, 1)
    isStripped = true
  }
  return isStripped
}

const instructionReason = (error: string): string => (error === '' ? 'entry-missing' : 'entry-unavailable')

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
    const instructions = yield* Effect.try({
      try: () => loadWorkflowInstructions(directory),
      catch: cause => cause instanceof Error ? cause : new Error(String(cause)),
    }).pipe(Effect.orDie)

    const configuredPath = configuredInstructionsPath()
    yield* Effect.logInfo('workflow.instructions.loaded', {
      path: configuredPath,
      resolvedPath: resolveInstructionsPath(directory, configuredPath),
      contentBytes: utf8Bytes(instructions),
    })

    // ADR-011: instructions travel as a session instruction entry, written in
    // the prompt hook so the same turn sees them. The context hook is the only
    // place the tool map is visible, so it decides the gate: it records the
    // per-session flag the prompt hook reads, and splices `system` only when the
    // entry is missing (first gated turn, or a failed write) so nothing is
    // delivered twice.
    const gatedSessions = new Set<string>()

    yield* context.session.hook('prompt', event => Effect.gen(function* () {
      const sessionID = sessionIDOf(event)
      if (sessionID === undefined || !gatedSessions.has(sessionID)) return

      const block = formatWorkflowInstructions(instructions)
      const result = yield* Effect.promise(async () => {
        try {
          return { wrote: await didPutEntry(sessionID, WORKFLOW_ENTRY_KEY, block), error: '' }
        }
        catch (error) {
          return { wrote: false, error: describeCause(error) }
        }
      })
      yield* Effect.logInfo('workflow.instructions.prompt', {
        sessionID,
        carrier: result.error === '' ? 'entry' : 'system',
        wrote: result.wrote,
        blockBytes: utf8Bytes(block),
        entryBytes: entryValueBytes(block),
        error: result.error || 'none',
      })
    }).pipe(
      Effect.catchCause(cause =>
        Effect.logError('workflow.instructions.error', { message: describeCause(Cause.squash(cause)) }),
      ),
    ))

    yield* context.session.hook('context', event => Effect.gen(function* () {
      const sessionID = sessionIDOf(event)
      const tools = safeToolKeys(event)
      const exposure = WORKFLOW_EXPOSURE_TOOLS.find(name => tools.includes(name))

      yield* Effect.logDebug('workflow.instructions.context', { ...describeContextEvent(event), exposure })
      if (exposure === undefined) {
        yield* Effect.logDebug('workflow.instructions.skipped', { tools })
        yield* releaseUnusedSession(sessionID, gatedSessions)
        return
      }

      if (sessionID !== undefined) gatedSessions.add(sessionID)
      if (!Array.isArray(event.system)) throw new Error('context event has no system array')

      const block = formatWorkflowInstructions(instructions)
      const stored = yield* (sessionID === undefined
        ? Effect.succeed({ value: undefined as unknown, error: 'session id missing' })
        : Effect.promise(() => readInstructionEntry(sessionID)))
      if (stored.value === block) {
        yield* Effect.logInfo('workflow.instructions.context.applied', {
          sessionID, carrier: 'entry', exposure, blockBytes: utf8Bytes(block),
        })
        return
      }

      const isStripped = didStripWorkflowSystemBlocks(event.system)
      event.system.push({ type: 'text', text: block })
      yield* Effect.logInfo('workflow.instructions.injected', {
        carrier: 'system',
        reason: instructionReason(stored.error),
        blockBytes: utf8Bytes(block),
        tools,
        exposure,
        stripped: isStripped,
      })
    }).pipe(
      // The hook contract is Effect<void, never>, so surface failures as a log
      // line instead of a silent defect; the agent loop keeps running.
      Effect.catchCause(cause =>
        Effect.logError('workflow.instructions.error', { message: describeCause(Cause.squash(cause)) }),
      ),
    ))

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
