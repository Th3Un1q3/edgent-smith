# OpenCode Permission Hooks: ask vs asked & SDK Method Usage

Pitfalls and working patterns for intercepting permission requests in OpenCode plugins, learned from the AFK-enforcer plugin (opencode 1.18.4).

## `permission.ask` Is Typed But Never Dispatched

The `permission.ask` hook exists in the plugin type surface but is NOT dispatched at runtime in opencode 1.18.4 — a registered handler never fires. Proven with live logs in one process: plugin initialized 5 hooks, hook body logged 0 invocations, while 582 runtime permission asks (`action.action=ask`) occurred. **Lesson: a typed hook is a contract, not a guarantee — prove dispatch with runtime logs before relying on it.**

## Working Path: `event` Hook on `permission.asked`

- Register on the `event` hook and filter for `permission.asked`.
- Payload: request id = `properties.id`; session id = `properties.sessionID`.
- Reject: `client.postSessionIdPermissionsPermissionId({ path: { id: sessionID, permissionID: requestID }, body: { response: 'reject' } })` — nested `path`/`body`; `response` is `'once' | 'always' | 'reject'`.
- The body type has NO `message` field — deliver the rationale via `sendMessage({ message, noReply: true })` (the `<steering>` post), not on the reject call.

## SDK v1/v2 Type Drift

`@opencode-ai/plugin`'s client is typed against SDK v1 while the runtime injects v2. `postSessionIdPermissionsPermissionId` exists on the v1-typed client, so call it directly — no cast needed. Do NOT introduce `PermissionReplyClient` casts (`(client as unknown as ...).permission.reply(...)`): they hide the real API and fail cleanliness gates.

## Diagnostics

- When a permission hook "never fires", count plugin init vs hook invocations in the same log: equal inits and zero invocations while asks keep flowing proves non-dispatch.
- Narrowing `event` payloads needs `event as unknown as { type?, properties? }` — the v1 `Event` union predates `EventPermissionAsked`; this narrowing cast is legitimate and distinct from the reject-path cast above.

## References

- mem:refactoring/plugin-lifecycle — Permission Gating pattern built on this mechanism
- mem:testing/plugin-mock-patterns — driving the event hook in Vitest