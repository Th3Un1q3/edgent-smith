---
id: cases/opencode/sdk_detached_method_this
type: cases
L0: "Detached generated SDK method loses this and throws this._client TypeError; always call client.session.<method>(...)"
hotness: 0.9
ttl: 180d
version: 1
freshness: 2026-09-19
directory: cases/opencode
provenance: .opencode/plugins/helpers/workflow-subtask.ts
---
Failure: const m = client.session.messages; m({ path: { id } }) throws TypeError: undefined is not an object (evaluating 'this._client').
Cause: generated OpenCode SDK methods are receiver-sensitive and read this._client.
Fix: always call as a member, e.g. client.session.messages({ path: { id } }); never assign a method to a bare const.
Detection gap: plain unit mocks record arguments and never exercise this, so the bug passed unit tests.
Guard: use a receiver-sensitive mock that throws when this is lost; regression test .opencode/plugins/tests/helpers/workflow-subtask.test.ts:610-624.
Impact if unguarded: parent-model resolution silently fails (mem:claims/opencode/sdk_child_model_inheritance).
Caught only by real-harness E2E: mem:claims/opencode/plugin_e2e_harness_recipe.