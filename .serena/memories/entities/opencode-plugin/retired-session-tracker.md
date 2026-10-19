---
id: entities/opencode-plugin/retired-session-tracker
type: entities
L0: "Retired v1 plugin session-tracker: recorded per-session startedAt, agent, lastMessageSentAt, toolCalls, cancelledAt, idleAt into SessionStorage; not in the live v2 plugin set."
hotness: 0.6
ttl: 90d
provenance: recovered source .tmp/retired-plugins/session-tracker.ts; git index .opencode/plugins-quarantine/session-tracker.ts
---

# session-tracker (retired OpenCode v1 plugin)

## What it did in v1
Recorded per-session lifecycle fields that other plugins consumed (agent identity, message/tool timestamps, cancellation and idle times).

## Key behaviours / signals
- `chat.message`: marks `SESSION_FIELDS.startedAt` once, sets `agent`, refreshes `lastMessageSentAt`.
- `tool.execute.before`: writes `SESSION_FIELDS.toolCalls` as a `{tool: timestamp}` map.
- `event`: `session.error` with `error.name === 'MessageAbortedError'` sets `cancelledAt`; `session.idle` sets `idleAt`. Throws if `event.properties` is not an object.
- All writes go through `SessionStorage.updateState`; fields are the shared `SESSION_FIELDS` keys other plugins read.

## Dependencies / config
Helpers `./helpers/logger` (log), `./helpers/kv-store` (SessionStorage, SESSION_FIELDS). No config options.

## Retirement
Retired; absent from the live `.opencode/plugins/` set. No live v2 plugin of the same name was identified as its replacement (UNVERIFIED); its session-field contract is consumed by other plugins.

## Recovery
Recoverable from the git index at `.opencode/plugins-quarantine/session-tracker.ts`; recovered copy at `.tmp/retired-plugins/session-tracker.ts`; test `.opencode/plugins-quarantine/tests/session-tracker.test.ts`.

Source: recovered source `.tmp/retired-plugins/session-tracker.ts`; live plugin set inspected at `.opencode/plugins/`.