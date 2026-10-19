---
id: claims/opencode/sdk_child_model_inheritance
type: claims
L0: "SDK child sessions do not inherit the parent model; in v2 read it from the parent SessionMessage.Info (assistant .model = Model.Ref {id, providerID}) and apply with session.switchModel before prompt"
hotness: 0.9
ttl: 60d
version: 2
freshness: 2026-10-06
directory: claims/opencode
confidence: 0.95
status: active
provenance: .opencode/plugins/helpers/workflow-client-adapter.ts + workflow-subtask.ts (live probe 2026-10-06)
---
fact: Child sessions created via session.create do not automatically inherit the parent turn model; native task-tool children do. Without an applied model a child falls back to the global default, which is often unreachable (observed: OpenRouter auth error -> empty subtask).
v2 read path: session.context({sessionID}) returns SessionMessage.Info[] (flat). The latest assistant message carries model = Model.Ref { id, providerID }. Map it to { providerID, modelID: model.id }.
v2 apply path: session.prompt does NOT accept a model. Call session.switchModel({ sessionID, model: { id: modelID, providerID } }) BEFORE session.prompt; the switch applies to subsequent provider turns.
boundary rule: the V1-shaped runner reads messages[].info.{providerID,modelID}; the adapter must map each v2 SessionMessage.Info to { info: { role: type, providerID: model?.providerID, modelID: model?.id } }. Do not pass raw v2 messages through.
optimization: memoize the parent-history probe once per workflow run so concurrent subtasks share it.
evidence: .opencode/plugins/helpers/workflow-client-adapter.ts (messages/prompt); .opencode/plugins/helpers/workflow-subtask.ts extractModel/findLatestModel/resolveParentModel; live subtask probe returned ok/PONG after the fix.
receiver pitfall: mem:cases/opencode/sdk_detached_method_this.