---
id: entities/opencode-plugin/workflow_fork_from_fanout
type: entities
L0: "OpenCode workflow subtask fork_from fanout: fork an existing session instead of creating one; task_id and fork_from are mutually exclusive; forked_from provenance on result"
hotness: 0.85
ttl: 180d
version: 1
freshness: 2026-09-20
directory: entities/opencode-plugin
provenance: "Change to .opencode/plugins/helpers/workflow-subtask.ts + workflow-types.ts, 2026-09-20, with tests and docs"
---
# Workflow subtask fork_from fanout
`subtask({ fork_from })` forks the source session (copying history up to the latest message) and sends the prompt as the followup on the fork; a forked subtask never calls `session.create`.

API and semantics:
- Input field `fork_from?: string` on SubtaskParameters. `task_id` and `fork_from` are mutually exclusive; supplying both returns `status: 'error'` with /mutually exclusive/ before either session is touched.
- Both ids are trimmed. Missing/undefined ids and empty/whitespace-only strings count as absent; a present non-string value (null, number, object) is a caller bug rejected with a `TypeError`, which `createSubtask` catches and returns as `status: 'error'`. Conflict detection runs on normalized ids, so a whitespace-only `task_id` plus a real `fork_from` is not a conflict.
- Result carries `forked_from` (source id) and `task_id` = fork id. `forked_from` survives failure paths: a fork that succeeded before the prompt threw, timed out, or aborted keeps both the fork id and `forked_from`.
- A forked subtask shows a run-tagged, description-derived lifecycle title, same as a created subtask: `wf#<6 hex> · [running] <description>` before the first prompt, then `wf#<6 hex> · [ok]/[error]/[aborted] <description>` once it settles. A fork does not preserve the source session title. Provenance is exposed via `forked_from` (the source session id).

File anchors:
- `.opencode/plugins/helpers/workflow-subtask.ts`: callFork / forkSession / resolveSessionID (fork branch), assertSourceUnambiguous, normalizeSessionId, classifyError provenance.
- `.opencode/plugins/helpers/workflow-types.ts`: WorkflowSdkClient.fork, SubtaskParameters.fork_from, SubtaskResult.forked_from.
- `.opencode/plugins/workflow.ts`: tool wiring.
- Tests: `.opencode/plugins/tests/helpers/workflow-subtask-fork.test.ts`, workflow-subtask-parameters.test.ts, workflow-fork-fanout.test.ts.
- Docs: `docs/workflow-tool.md` (Fork fanout section).

Live-harness proof (2026-09-20): an `opencode run` fanout returned envelope `status: ok` with 5/5 subtasks; three forks ran distinct audit questions off one read session and each result reported the correct `forked_from`.
Source: observed code change. See mem:entities/opencode-plugin/sdk_session_fork_v1 and mem:cases/opencode/workflow_fork_from_envelope_truncation.