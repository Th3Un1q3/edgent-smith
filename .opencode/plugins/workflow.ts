import { tool } from '@opencode-ai/plugin'
import type { Plugin } from '@opencode-ai/plugin'

import { DEFAULT_TIMEOUT_SECONDS, runWorkflow } from './helpers/workflow-runner'
import type { WorkflowSdkClient } from './helpers/workflow-runner'
import {
  DEFAULT_MAX_CONCURRENT,
  DEFAULT_MAX_SUBTASKS,
} from './helpers/workflow-types'

const WORKFLOW_TOOL_DESCRIPTION = [
  'Execute a JavaScript workflow script that orchestrates subagents.',
  'The script runs with three helpers: subtask, log, and progress.',
  '',
  'subtask(input) -> Promise<result>',
  '- input: a string prompt, or {prompt, description, agent?, skills?, task_id?, timeout_ms?, schema?}',
  '- description: required for the object form; a one-line indication of what the subtask does. The string',
  '  shorthand derives it from the first 80 chars of the prompt. Truncated to 80 chars in the step record.',
  '- result: {outputText, task_id, status, error?, durationMs, truncated, data?}',
  '- status: \'ok\' | \'error\' | \'empty\' | \'timeout\' | \'aborted\'',
  '- Failed children never throw; inspect status. Concurrency is bounded automatically (default 4),',
  '  so Promise.all fan-out is safe. Subtasks are default-capped at 32 (1-64); exceeding the budget',
  '  throws BudgetExceededError inside the script, surfacing as budget_exceeded unless the script catches it.',
  '- Children default to the rug-swe agent; pass agent per subtask to override. Child tool access',
  '  follows the child agent\'s own permission scopes.',
  '- task_id continues/resumes an existing child session.',
  '- skills: string[] loads .agents/skills/<name>/SKILL.md into the child prompt.',
  '- schema: a JSON Schema object. The child returns its full answer, optionally with prose or code, plus one',
  '  JSON block between <result_json> and </result_json>. The parser reads that block (tolerating an inner',
  '  fence) and falls back to parsing the whole reply as JSON; when schema.required is a non-empty array of',
  '  strings, every name in it must be a key of the parsed object. On an unusable reply the runtime sends one',
  '  corrective follow-up on the same session; if still unusable status is error. Prompt contract, not a full',
  '  validator: treat result.data defensively. The native SDK body.format path is not used (ADR-003) because',
  '  the available model rejects it in thinking mode.',
  '- result.data is the parsed JSON (absent without a schema or on parse failure); it is never truncated or',
  '  stringified. outputText is the raw reply truncated to the per-step cap.',
  '',
  'log(message) -> appends a marker to the envelope logs.',
  '',
  'progress({title, metadata}) -> updates the running tool call\'s live title and metadata while the',
  'script runs. Fire-and-forget; it does not create a subtask. Use it for phase-level status, e.g.',
  'progress({title: \'phase: reduce\'}). Each subtask start and finish also updates the live title.',
  '',
  'Patterns:',
  '- Fan-out: const rs = await Promise.all(items.map(i => subtask(i)))',
  '- Chain: const a = await subtask("step 1"); const b = await subtask({prompt: "step 2 " + a.outputText, description: "refine step 1", task_id: a.task_id})',
  String.raw`- Map-reduce: const parts = await Promise.all(items.map(i => subtask(i))); const merged = await subtask({prompt: parts.map(p => p.outputText).join("\n"), description: "merge results"})`,
  '- Structured: const r = await subtask({prompt: "Classify x", description: "classify x", schema: {type: "object", required: ["label"]}}); if (r.data?.label === "urgent") ...',
  '  Fan out schemas then reduce over data: const rs = await Promise.all(items.map(i => subtask({prompt: i, description: "classify item", schema}))); await subtask({prompt: JSON.stringify(rs.map(r => r.data)), description: "reduce classifications"})',
  '',
  'The script must return a small JSON-serializable object (becomes result).',
  '',
  'A guard rejects import/require, bare Function( and new Function, eval(, constructor, process, globalThis,',
  'global, Bun, Deno, fetch( and similar; forbidden tokens return forbidden_script, syntax errors invalid_script.',
  'Scripts are trusted agent code, not sandboxed.',
  '',
  'Tool result: {title, output, metadata}. output is the JSON envelope string, metadata is',
  '{status, stats}, and title is a summary such as "workflow: ok, 3/5 subtasks".',
  '',
  'Envelope: {status, result, error?, steps, stats, logs} with status one of',
  'ok | error | timeout | aborted | budget_exceeded | invalid_script | forbidden_script;',
  'result serialized to fit an 8 KB envelope (logs dropped, then steps).',
  'Steps: {label, description, task_id, status, durationMs, error?, truncated};',
  'description in a step is the subtask description truncated to 80 chars.',
  'stats: {subtasks, ok, error, empty, timeout, aborted, totalMs, truncated}.',
  '',
  'Example:',
  'const rs = await Promise.all(["a", "b"].map(p => subtask(p)))',
  String.raw`const summary = await subtask({prompt: "Summarize: " + rs.map(r => r.outputText).join("\n"), description: "summarize results", task_id: rs[0].task_id})`,
  'log("done")',
  'return { summary: summary.outputText, sources: rs.length }',
].join('\n')

interface WorkflowToolResult {
  title: string
  output: string
  metadata: { status: string, stats: unknown }
}

const readNumber = (value: unknown): number => (typeof value === 'number' ? value : 0)

// `runWorkflow` stays a string-producing function; the tool boundary wraps its
// serialized envelope in a ToolResult so the harness can render a status line
// and structured metadata. A malformed envelope degrades to a safe title.
const toToolResult = (output: string): WorkflowToolResult => {
  try {
    const envelope = JSON.parse(output) as { status?: unknown, stats?: { ok?: unknown, subtasks?: unknown } }
    const status = typeof envelope.status === 'string' ? envelope.status : 'unknown'
    const stats = envelope.stats ?? {}
    const ok = readNumber(stats.ok)
    const subtasks = readNumber(stats.subtasks)
    return {
      title: `workflow: ${status} · ${ok}/${subtasks} subtasks`,
      output,
      metadata: { status, stats },
    }
  }
  catch {
    return {
      title: 'workflow: unparseable envelope',
      output,
      metadata: { status: 'error', stats: {} },
    }
  }
}

export const workflowPlugin: Plugin = async ({ client, directory }) => ({
  tool: {
    workflow: tool({
      description: WORKFLOW_TOOL_DESCRIPTION,
      args: {
        script: tool.schema
          .string()
          .min(1)
          .describe('JS workflow script; runs with three helpers: subtask, log, and progress, no import/require.'),
        timeout_seconds: tool.schema
          .number()
          .min(1)
          .max(36_000)
          .optional()
          .default(DEFAULT_TIMEOUT_SECONDS)
          .describe('Overall workflow timeout in seconds.'),
        max_concurrent: tool.schema
          .number()
          .min(1)
          .max(8)
          .optional()
          .default(DEFAULT_MAX_CONCURRENT)
          .describe('Maximum concurrent child subagents.'),
        max_subtasks: tool.schema
          .number()
          .min(1)
          .max(64)
          .optional()
          .default(DEFAULT_MAX_SUBTASKS)
          .describe('Maximum subtasks before the budget is exhausted.'),
      },
      execute: async (arguments_, context) => {
        const output = await runWorkflow({
          script: arguments_.script,
          client: client as unknown as WorkflowSdkClient,
          parentSessionID: context.sessionID,
          directory: context.directory ?? directory,
          timeoutMs: (arguments_.timeout_seconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000,
          maxConcurrent: arguments_.max_concurrent,
          maxSubtasks: arguments_.max_subtasks,
          onProgress: progress => context.metadata({ title: progress.title, metadata: progress.metadata }),
          abort: context.abort,
        })
        return toToolResult(output)
      },
    }),
  },
})
