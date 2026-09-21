---
id: entities/opencode-plugin/sdk_session_fork_v1
type: entities
L0: "v1 SDK: client.session.fork({path:{id}}) returns Session with fork id at data.id; call receiver-bound; fork copies history while session.create({parentID}) starts empty"
hotness: 0.8
ttl: 180d
version: 1
freshness: 2026-09-20
directory: entities/opencode-plugin
provenance: ".opencode/plugins/helpers/workflow-subtask.ts callFork + workflow-subtask-fork.test.ts, 2026-09-20"
---
# OpenCode v1 SDK session.fork
SDK fact used by workflow `fork_from`.
- Call `client.session.fork({ path: { id } })`; it returns a Session object and the new fork id is at `data.id`.
- Invoke it receiver-bound (`client.session.fork(...)`); a detached reference loses `this` — see mem:cases/opencode/sdk_detached_method_this.
- Forking copies the source conversation history up to the latest message; the prompt then appends to that copied context.
- `session.create({ body: { parentID } })` starts an empty session (no history copy) parented to the caller.
- `fork` is optional on the client surface; guard `session.fork === undefined` and return a subtask error instead of throwing.
Anchors: workflow-subtask.ts callFork / resolveSessionID; test "forks the source session on its receiver" in workflow-subtask-fork.test.ts uses a `this.marker` proof.
Source: observed code change. See mem:entities/opencode-plugin/workflow_fork_from_fanout.