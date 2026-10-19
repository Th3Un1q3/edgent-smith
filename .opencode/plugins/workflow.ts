/**
 * workflow — OpenCode v2 Effect plugin (migrated).
 *
 * V1 returned a `tool` map; V2 registers custom tools through
 * `ctx.tool.transform(editor => editor.add({ ... }))` with a JSON-Schema input.
 * The runner is reused through a client adapter over `ctx.session`
 * (see helpers/workflow-client-adapter.ts).
 */
import { Effect } from 'effect'
import type { Plugin } from '@opencode/plugin/effect/plugin'
import { DEFAULT_TIMEOUT_MINUTES, runWorkflow } from './helpers/workflow-runner'
import { createWorkflowClient } from './helpers/workflow-client-adapter'
import { formatElapsed } from './helpers/workflow-subtask'
import { DEFAULT_MAX_CONCURRENT, DEFAULT_MAX_SUBTASKS } from './helpers/workflow-types'

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
  'Patterns:',
  '- Fan-out: const rs = await Promise.all(items.map(i => subtask(i)))',
  '- Chain: const a = await subtask("step 1"); const b = await subtask({prompt: "step 2 " + a.outputText, description: "refine", task_id: a.task_id})',
  '- Structured: const r = await subtask({prompt: "Classify x", description: "classify x", schema: {type: "object", required: ["label"]}}); if (r.data?.label === "urgent") ...',
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
  '',
  'Example:',
  'const rs = await Promise.all(["a", "b"].map(p => subtask(p)))',
  'return { count: rs.length }',
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
    yield* context.tool.transform((editor) => {
      editor.add({
        name: 'workflow',
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
