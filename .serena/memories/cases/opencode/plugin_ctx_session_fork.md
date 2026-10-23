---
id: cases/opencode/plugin_ctx_session_fork
type: cases
L0: "OpenCode v2 plugin ctx.session omits fork; fork via @opencode/client getClient(undefined, directory), session.fork({sessionID}) with no before to fork at latest message"
hotness: 0.7
ttl: 180d
version: 1
freshness: 2026-10-22
directory: cases/opencode
provenance: "Observed RUG run 2026-10-22"
---
# Plugin context has no session.fork
Idea: The plugin `Context` exposes `ctx.session` as a narrowed SessionDomain with no `fork`. Forking requires the SDK client from `helpers/service-client.ts` `getClient(undefined, directory)`, called as `session.fork({ sessionID })`.
Scope: OpenCode v2 plugin authors; the fork path in `helpers/workflow-subtask.ts`.
Rationale: `ctx.session` is a narrowed domain; `session.fork` exists only on `@opencode/client`. Pass exactly `{ sessionID }` and no `before`: omitting `before` forks at the session's latest message, the "continue this conversation" semantics, while a `before` value forks at an older boundary. Call it as a member (`client.session.fork(...)`), never a detached method, or `this` is lost.
Source: observed RUG run 2026-10-22; `.opencode/plugins/helpers/workflow-subtask.ts:697-719`; mem:cases/opencode/sdk_detached_method_this