---
id: entities/opencode-plugin/retired-tool-limit-reminder
type: entities
L0: "Retired v1 plugin tool-limit-reminder: advertised a task-budget and enforced per-agent tool-call limits with steering, blocking, and session export on idle; migrated to v2."
hotness: 0.6
ttl: 90d
provenance: recovered source .tmp/retired-plugins/tool-limit-reminder.ts; git index .opencode/plugins-quarantine/tool-limit-reminder.ts
---

# tool-limit-reminder (retired OpenCode v1 plugin)

## What it did in v1
Told each agent its tool-call budget, then reminded, flagged, and finally blocked it as the budget was consumed; exported the session for review on idle.

## Key behaviours / signals
- `chat.message`: injects `<task-budget tool-calls="floor(steps * factor)"/>` once per session; factor default 0.8 from `harness.config.ts`.
- `tool.execute.before`: counts calls in an in-memory `Map` (the counting source of truth); agents absent from the resolved limits are unlimited. Per-agent limits = `floor(maxSteps * factor)` from `client.app.agents()`.
- Tiers: at threshold warns (`type="instructions"`); above threshold flags `needsReview` and adds a problem statement; above threshold + padding (default 2) throws to block further tools.
- `event` `session.idle`: clears counters; if `needsReview` or problems exist, runs `just agent_utils/export-opencode-session <id>`, writes `problems.md`, clears review state.

## Dependencies / config
Helpers `./helpers/logger`, `./helpers/session-helpers`, `./helpers/kv-store`, `./helpers/agent-steps`, `./helpers/review`, `./helpers/types`; `./config/harness.config` (`factor`, `padding`).

## Retirement
Migrated to the live v2 plugin `.opencode/plugins/tool-limit-reminder.ts`; ADR-009 references "the migrated tool-limit-reminder counters".

## Recovery
Recoverable from the git index at `.opencode/plugins-quarantine/tool-limit-reminder.ts`; recovered copy at `.tmp/retired-plugins/tool-limit-reminder.ts`; test `.opencode/plugins-quarantine/tests/tool-limit-reminder.test.ts`.

Source: recovered source `.tmp/retired-plugins/tool-limit-reminder.ts`; live plugin listed in `.opencode/plugins/`; ADR-009 at `.tmp/adr/ADR-009-skill-usage-heuristics.md`.