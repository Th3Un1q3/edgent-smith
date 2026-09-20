---
id: claims/opencode/sdk_child_model_inheritance
type: claims
L0: "SDK-spawned child sessions do not inherit the parent model; resolve it from parent session.messages and pass body.model"
hotness: 0.9
ttl: 60d
version: 1
freshness: 2026-09-19
directory: claims/opencode
confidence: 0.95
status: active
provenance: .opencode/plugins/helpers/workflow-subtask.ts
---
fact: Child sessions spawned via SDK session.create do not automatically inherit the parent turn model; native task-tool children do.
Behavior: without body.model a child falls back to the global default model, which is often unreachable or wrong.
Fix: call client.session.messages({ path: { id: parentSessionID } }) as a member, take the latest info.model or info.providerID+info.modelID, and pass body.model to session.prompt.
Optimization: memoize the parent-history probe once per workflow run so concurrent subtasks share it.
evidence: .opencode/plugins/helpers/workflow-subtask.ts:189-248 (extractModel/findLatestModel/resolveParentModel), :304-317 (body.model), :446-450 (memoize). Receiver pitfall: mem:cases/opencode/sdk_detached_method_this.