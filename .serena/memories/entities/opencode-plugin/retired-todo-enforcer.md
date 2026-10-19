---
id: entities/opencode-plugin/retired-todo-enforcer
type: entities
L0: "Retired v1 plugin todo-enforcer: forced the rug agent to write todos before the task tool and re-prompted on session.idle, breaking the loop after 3 errors."
hotness: 0.6
ttl: 90d
provenance: recovered source .tmp/retired-plugins/todo-enforcer.ts; git index .opencode/plugins-quarantine/todo-enforcer.ts
---

# todo-enforcer (retired OpenCode v1 plugin)

## What it did in v1
Required the `rug` agent to write todos before using the `task` tool, and re-prompted idle sessions that still had pending todos.

## Key behaviours / signals
- `tool.execute.before`: for `task` calls by agents in `AGENTS_REQUIRED_TO_START_WITH_TODOS` (`rug`) without a recent `todowrite`, throws an error suspending all tools until `todowrite` runs. Command-driven tasks (`output.args.command`) bypass enforcement.
- `event` `session.idle`: after a 500ms `setTimeout`, if pending/in-progress todos remain, sends `buildTodoContinuationMessage` (steering type `todo`) unless the session was cancelled after the last message.
- `session.error`: increments `todoFollowupErrorCount` (excluding `MessageAbortedError`); at `maxConsecutiveErrors` (default 3) it writes `todoFollowupBrokenAt` and breaks the loop.
- `chat.message`: a message created after the break recovers the loop (`recoverBrokenFollowUpLoop`).

## Dependencies / config
Helpers `./helpers/logger`, `./helpers/session-helpers`, `./helpers/kv-store` (SessionStorage, SESSION_FIELDS), `./helpers/agent-steps` (getSessionAgent); `./config/harness.config` (`maxConsecutiveErrors`).

## Retirement
Retired; absent from the live `.opencode/plugins/` set. No live v2 plugin of the same name was identified as its replacement (UNVERIFIED).

## Recovery
Recoverable from the git index at `.opencode/plugins-quarantine/todo-enforcer.ts`; recovered copy at `.tmp/retired-plugins/todo-enforcer.ts`; test `.opencode/plugins-quarantine/tests/todo-enforcer.test.ts`.

Source: recovered source `.tmp/retired-plugins/todo-enforcer.ts`; live plugin set inspected at `.opencode/plugins/`.