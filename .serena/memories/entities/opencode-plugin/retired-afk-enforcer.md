---
id: entities/opencode-plugin/retired-afk-enforcer
type: entities
L0: "Retired OpenCode v1 plugin afk-enforcer: while .tmp/is_afk exists it rejects permission.asked requests and posts an AFK steering message."
hotness: 0.7
ttl: 90d
provenance: recovered source .tmp/retired-plugins/afk-enforcer.ts; git index .opencode/plugins-quarantine/afk-enforcer.ts
---

# afk-enforcer (retired OpenCode v1 plugin)

## What it did in v1
Rejected OpenCode permission requests while an AFK flag file existed, and told the session why.

## Key behaviours / signals
- `event` hook narrows `permission.asked` structurally (properties `id`, `sessionID`, `permission`, `patterns`); the v1 `Event` union predates the member, so it matches by `type === 'permission.asked'`, not by discriminant.
- Reads the AFK flag with `fs.access` at `flagPath`, default `path.join(directory, '.tmp', 'is_afk')`; missing file means AFK inactive.
- When AFK is active: logs, calls `client.postSessionIdPermissionsPermissionId({path:{id:sessionID, permissionID:requestID}, body:{response:'reject'}})`, then `sendMessage({..., message: buildAfkMessage(permission, patterns), noReply:true})` because the reject body carries no reason field.
- `'permission.ask'` hook registered as a no-op for forward compatibility; v1 had no runtime dispatch for it, so enforcement lives in `event`.

## Dependencies / config
Plugin deps `@opencode-ai/plugin`, `@opencode-ai/sdk`; helpers `./helpers/logger` (log), `./helpers/session-helpers` (sendMessage), `./helpers/afk` (buildAfkMessage). Option `{ flagPath?: string }`; default flag `.tmp/is_afk`.

## Retirement
Retired; absent from the live `.opencode/plugins/` set. No live v2 plugin replaces it and it is not covered by ADR-009, so the AFK permission-denial behaviour is not carried forward. A user may recall the AFK denial behaviour.

## Recovery
Recoverable from the git index at `.opencode/plugins-quarantine/afk-enforcer.ts`; recovered copy at `.tmp/retired-plugins/afk-enforcer.ts`; test `.opencode/plugins-quarantine/tests/afk-enforcer.test.ts`.

Source: recovered source `.tmp/retired-plugins/afk-enforcer.ts`; quarantine path confirmed via `git ls-files .opencode/plugins-quarantine/`.