---
id: projects/opencode-workflows/workflow-tool/subtask-run-arguments
type: entities
L0: "subtask_run takes required prompt and description plus optional agent, skills, task_id, fork_from, label, timeout_minutes and schema; task_id, fork_from and label are mutually exclusive"
freshness: 2026-11-24
directory: projects/opencode-workflows/workflow-tool
ttl: 180d
provenance: docs/workflow-tool.md — section subtask_run Arguments (## subtask_run, arguments table and prose, lines 11-31)
---
# subtask_run arguments

| Field | Required | Default | Purpose |
|---|---|---|---|
| `prompt` | Yes | none | Text sent to the child session. Must be non-empty. |
| `description` | Yes | none | One-line indication of what the subtask does, truncated to 80 characters. |
| `agent` | No | `rug-swe` | Agent that handles the child prompt. Child tool access follows that agent's permission scopes. |
| `skills` | No | none | Skill names resolved through the session's native skill list and injected into the child prompt as a `<task_skills>` envelope: one `<skill name="...">` element per skill, holding a `description:` line when the skill declares one, a `path:` line relative to the session directory when the record exposes a path inside it, then the skill body with its YAML frontmatter stripped. Nothing is read from `.agents/skills/` on disk. Unknown names are skipped and logged. |
| `task_id` | No | none | Resume an existing child session instead of creating or forking one. Mutually exclusive with `fork_from`. |
| `fork_from` | No | none | Fork this session id, copy its conversation history up to the latest message, and deliver this subtask's prompt as the followup on the fork. The result's `task_id` is the new fork id. Mutually exclusive with `task_id`. |
| `label` | No | none | Session-scoped alias for the child. Mutually exclusive with `task_id` and `fork_from`. |
| `timeout_minutes` | No | `15` | Per-subtask timeout in minutes. On expiry the subtask returns `status: 'timeout'` and an `error` naming the limit in minutes. |
| `schema` | No | none | JSON Schema object requesting structured output. |

`description` is truncated to 80 characters and becomes the new child session's title, with no run-id prefix and no lifecycle marker. The plugin sets no title on a fork; fork provenance appears in the result's `forked_from`.

## task_id resumes

`task_id` resumes an existing child session instead of creating or forking one. The caller still passes a `prompt`; the child sees the new prompt in its existing context.

## task_id and fork_from are exclusive

Pass at most one, because either alone selects the mode: `task_id` resumes, `fork_from` forks. Supplying both returns a subtask with `status: 'error'` and an `error` naming the conflict; the runtime rejects the ambiguity before it touches either session.

## fork_from forks

`fork_from` branches instead of appending. The runtime forks the named session, copying its history up to the latest message, then sends this subtask's prompt as the followup on the fork. The result's `task_id` is the fork id, and `forked_from` repeats the source id. The runtime trims surrounding whitespace and rejects a blank or whitespace-only value with `status: 'error'`, rather than falling back to a fresh session or the source. The fork is independent of the source, so later turns on the fork leave the source session alone. Omit `fork_from` and the subtask creates a fresh child; pass the returned `task_id` to a later `subtask_run({ task_id })` call to continue that fork or fresh child.

## label binds, resumes, refuses

The first call binds the label to the child it creates, every later call with that label resumes the same child, and a label never rebinds. A finished child resumes, while a running or dead (`error`/`aborted`) one returns `status: 'error'`. A label is mutually exclusive with `task_id` and `fork_from`.

`schema` is documented in mem:projects/opencode-workflows/workflow-tool/structured-output.