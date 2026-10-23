---
id: cases/opencode/fork_parentid_lineage
type: cases
L0: "Forked sessions are not parentID children of the calling session; subtask_ls lists parentID children only, so track the returned task_id (the fork id) as the only handle"
hotness: 0.7
ttl: 180d
version: 1
freshness: 2026-10-22
directory: cases/opencode
provenance: "Observed RUG run 2026-10-22"
---
# Forked sessions are invisible to parentID listing
Idea: A forked session is not a `parentID` child of the session that requested the fork, so `subtask_ls` — which lists `reader.list({ parentID })` — omits it. Track the returned `task_id`, the fork id.
Scope: orchestrators auditing subtask work; `helpers/subtask-ls.ts`.
Rationale: `session.fork({ sessionID })` has no parent override, so the fork inherits the source session's parent, not the caller's. The audit surface is parent-based, so forked work never appears in `subtask_ls` even while it runs. The `task_id` returned by `subtask_run` is the only handle for resume, tail, and report.
Source: observed RUG run 2026-10-22; `.opencode/plugins/helpers/workflow-subtask.ts:705`; `.opencode/plugins/helpers/subtask-ls.ts:129`; mem:cases/opencode/plugin_ctx_session_fork