---
id: projects/opencode-workflows/workflow-tool/subtask-outputs
type: entities
L0: "subtask_outputs reads a child session's stored assistant messages: {task_id, outputText, sent_at, status} oldest first, count clamped to 1-5 default 3, no field required; an empty array means nothing was read, not that the child failed"
freshness: 2026-11-24
directory: projects/opencode-workflows/workflow-tool
ttl: 180d
provenance: docs/workflow-tool.md — section subtask_outputs (## subtask_outputs, lines 135-148)
---
# subtask_outputs

The only reader for a child's output. It reads the child session's stored messages through the client `message.list` call, so its output survives a plugin restart.

Arguments:

| Field | Range | Default | Purpose |
|---|---|---|---|
| `task_id` | non-empty string | none | Child session id to read; the `task_id` returned by `subtask_run`. |
| `count` | 1 to 5 | 3 | Maximum outputs to return; the tool clamps the value to 1-5. |

No field is required. An absent, unknown, or empty `task_id` returns an empty array.

Returns an array of `{ task_id, outputText, sent_at, status }`, oldest first:

- `outputText` is one message's assistant text parts joined with newlines, oldest part first.
- `sent_at` is an ISO timestamp.
- `status` is `ok`, or `error` when the message carries an error or finished with `error` or `content-filter`.

An empty array means no output was read, not that the child failed: the caller re-runs the subtask or opens the child session. `subtask_ls` returning `[]` is a different signal — no child is parented to the session, or the child is a fork.

Each call titles its result `subtask_outputs: <n> output(s)`.