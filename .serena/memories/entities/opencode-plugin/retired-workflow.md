---
id: entities/opencode-plugin/retired-workflow
type: entities
L0: "Retired v1 plugin workflow: exposed a workflow tool running a JS script that orchestrates subagents via subtask()/log() with bounded concurrency; migrated to v2."
hotness: 0.6
ttl: 90d
provenance: recovered source .tmp/retired-plugins/workflow.ts; git index .opencode/plugins-quarantine/workflow.ts
---

# workflow (retired OpenCode v1 plugin)

## What it did in v1
Exposed a `workflow` tool that runs a JavaScript script orchestrating child subagent sessions.

## Key behaviours / signals
- Tool args: `script`, `timeout_minutes` (1-600, default from `DEFAULT_TIMEOUT_MINUTES`), `max_concurrent`, `max_subtasks`; script runs with `subtask(input)` and `log(message)` helpers.
- `subtask` returns `{outputText, task_id, status, error?, durationMs, truncated, data?, forked_from?}`; statuses `ok|error|empty|timeout|aborted`; failed children never throw. Supports `task_id` (resume) vs `fork_from` (fork, mutually exclusive), per-subtask `agent`, `skills`, and a JSON `schema` (parsed from a `<result_json>` block).
- A guard rejects `import/require`, `eval(`, `Function`, `process`, `globalThis`, `fetch(`, etc. (`forbidden_script`); syntax errors return `invalid_script`.
- Result envelope `{status, result, error?, steps, stats, logs}`, statuses `ok|error|timeout|aborted|budget_exceeded|invalid_script|forbidden_script`, serialized to fit 8 KB. `toToolResult` renders the title `workflow: <status> · ok/subtasks subtasks · <elapsed>`.

## Dependencies / config
Helpers `./helpers/workflow-runner` (`runWorkflow`, `WorkflowSdkClient`, `DEFAULT_TIMEOUT_MINUTES`), `./helpers/workflow-subtask` (`formatElapsed`), `./helpers/workflow-types` (`DEFAULT_MAX_CONCURRENT`, `DEFAULT_MAX_SUBTASKS`).

## Retirement
Migrated to the live v2 plugin `.opencode/plugins/workflow.ts`.

## Recovery
Recoverable from the git index at `.opencode/plugins-quarantine/workflow.ts`; recovered copy at `.tmp/retired-plugins/workflow.ts`; test `.opencode/plugins-quarantine/tests/workflow.test.ts`.

Source: recovered source `.tmp/retired-plugins/workflow.ts`; live plugin listed in `.opencode/plugins/`.