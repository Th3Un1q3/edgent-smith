---
id: projects/opencode-workflows/workflow-tool/subtask-ls
type: entities
L0: "subtask_ls lists child sessions parented to the caller: {description, durationMs, task_id, status}, count 1-50 default 10, optional status filter; forks never appear and a title's leading [ok]/[error] is stripped"
freshness: 2026-11-24
directory: projects/opencode-workflows/workflow-tool
ttl: 180d
provenance: docs/workflow-tool.md — section subtask_ls (## subtask_ls, lines 124-133) and section Inspecting subsessions (## Inspecting subsessions, lines 200-204)
---
# subtask_ls

Lists the child subtasks of the calling session.

Arguments:

| Field | Range | Default | Purpose |
|---|---|---|---|
| `count` | 1 to 50 | 10 | Maximum rows to return. |
| `status` | `ok` or `error` | none | Return only subtasks with this status. |

Returns an array of `{ description, durationMs, task_id, status }` for the child sessions parented to the calling session:

- `description` is the child's title, truncated to 80 characters, with a leading `[ok]` or `[error]` marker stripped before return.
- `durationMs` is wall time; `task_id` is the child session id; `status` is `ok` or `error`.

Forks do not appear in the listing. A fork is not a `parentID` child, so the tool, which lists only sessions whose parent is the caller, omits it; the caller reads a fork through the `task_id` the fork returned, then `subtask_outputs`.

Code-verified: a labelled child's row also carries an optional `label` field, joined from the session's label document by `withLabels` (`.opencode/plugins/workflow.ts:212-216`, with `LsEntry.label` declared at `.opencode/plugins/workflow/contracts.ts:125`).

Each call titles its result `subtask_ls: <n> subtask(s)`.