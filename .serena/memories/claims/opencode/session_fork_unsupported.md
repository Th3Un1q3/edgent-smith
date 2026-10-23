---
id: claims/opencode/session_fork_unsupported
type: claims
L0: "session.fork is supported: subtask_run fork_from forks the source session at its latest message, excludes task_id, and needs a reachable service client"
hotness: 0.7
ttl: 60d
version: 2
freshness: 2026-10-22
directory: claims/opencode
confidence: 0.95
status: active
provenance: live verification 2026-10-22 plus a fresh-judge audit of helpers/workflow-subtask.ts and helpers/service-client.ts against the tool docs
---
# session_fork_unsupported

The memory id keeps its historical name, which is now false; the fact below supersedes it.

fact: subtask_run supports fork_from. The parameter forks the source session at its latest message by calling `session.fork({ sessionID })` from `@opencode/client` with no boundary; the client comes from `getClient(undefined, directory)` in `helpers/service-client.ts`.
scope: Orchestrators branching work or forking context.
constraints:
- fork_from is mutually exclusive with task_id; a blank value is rejected.
- A fork failure returns status "error" with no fallback path.
- subtask_ls lists a fork whose recorded source is the caller or one of its children.
- A reachable service client is required.
rule: Use fork_from when the child needs the source transcript; use task_id to continue an existing child.
Source: live verification, 2026-10-22 — a subtask run with fork_from set to a source session id forked that session at its latest message and the child quoted the source's final line; code read in helpers/workflow-subtask.ts and helpers/service-client.ts.