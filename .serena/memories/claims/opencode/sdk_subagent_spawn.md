---
id: claims/opencode/sdk_subagent_spawn
type: claims
L0: "OpenCode plugin SDK spawns real child subagents via session.create then session.prompt; child session id is task_id"
hotness: 0.9
ttl: 60d
version: 2
freshness: 2026-09-19
directory: claims/opencode
confidence: 0.95
status: active
claim_ids: [claims/opencode/sdk_structured_output, claims/opencode/sdk_structured_fallback]
provenance: .opencode/plugins/helpers/workflow-subtask.ts
---
fact: An OpenCode plugin tool spawns a real subagent by creating a child session then prompting it; the returned child session id is the resumable task_id.

contract (verified live):
- await client.session.create({ body: { title, parentID: parentSessionID } }) returns { data: { id } }; the child links to the parent via parentID.
- await client.session.prompt({ path: { id: childID }, signal, body: { agent, parts: [{ type: 'text', text }], tools } }) blocks until the turn ends.
- final text = join of parts where type === 'text'.
- cancel via the prompt signal (AbortSignal) plus client.session.abort({ path: { id } }).
- injected parts of type 'subtask' are metadata-only and do NOT execute; only 'text' parts run.

evidence: .opencode/plugins/helpers/workflow-subtask.ts:328 (create+parentID), :521 (prompt+signal), :97 (extractOutputText), :504 (session.abort). Unit contract: .opencode/plugins/tests/workflow.test.ts:67. Live probe: mem:claims/opencode/plugin_e2e_harness_recipe.