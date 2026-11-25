---
id: projects/opencode-workflows/workflow-tool/subtask-run-result
type: entities
L0: "subtask_run returns outputText, task_id, status, durationMs plus forked_from, label, error and data when present; any status other than ok is a failure to act on"
freshness: 2026-11-24
directory: projects/opencode-workflows/workflow-tool
ttl: 180d
provenance: docs/workflow-tool.md — section subtask_run Result fields (result table and the paragraphs after it, lines 33-48)
---
# subtask_run result

| Field | Type | Meaning |
|---|---|---|
| `outputText` | string | Text parts joined with newlines, in full. |
| `task_id` | string | Child session id. Pass it back to continue the conversation. On a forked subtask this is the fork id. |
| `forked_from` | string, absent unless forked | Source session id when `fork_from` was set. |
| `label` | string, absent unless labelled | The child's session-scoped alias, echoed from the call's `label`; present only when the call carried one. |
| `status` | string | One of `ok`, `error`, `empty`, `timeout`, `aborted`. |
| `error` | string, absent on success | Failure message. |
| `durationMs` | number | Wall time for the call. |
| `data` | unknown, absent unless requested | Parsed value for a schema subtask. Absent when no `schema` was passed or parsing failed; never truncated or stringified. |

## status is the verdict

`status` is one of `ok`, `error`, `empty`, `timeout`, `aborted`. Treat `status !== 'ok'` as a failure and decide what to do: retry, fall back, or surface it. Read `error` for the failure message; it is absent on success. `timeout` means the child exceeded `timeout_minutes`; `empty` means the child returned no text.

## data is present only for a parsed schema reply

`data` carries the parsed value for a schema subtask. It is absent when no `schema` was passed or when parsing failed, and it is never truncated or stringified.

## outputText by default, data for a machine value

Read `outputText` by default. Read `data` only when the next step needs a machine value, such as a branch, loop, or merge.

## Interrupting aborts the child

Interrupting the `subtask_run` call aborts the running child session, so the child stops instead of running to its timeout.