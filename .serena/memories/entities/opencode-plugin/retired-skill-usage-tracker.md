---
id: entities/opencode-plugin/retired-skill-usage-tracker
type: entities
L0: "Retired v1 plugin skill-usage-tracker: counted per-session steps and loaded skills and wrote a ProblemStatement on threshold crossing; replaced by ADR-009 heuristics."
hotness: 0.6
ttl: 90d
provenance: recovered source .tmp/retired-plugins/skill-usage-tracker.ts; ADR-009 .tmp/adr/ADR-009-skill-usage-heuristics.md
---

# skill-usage-tracker (retired OpenCode v1 plugin)

## What it did in v1
Tracked which skills a session loaded and how many steps it took, then flagged a session when a skill's step budget was exceeded.

## Key behaviours / signals
- `chat.message`: scans the first user message for `<skill name="...">` markers (source `prompt`).
- `tool.execute.after`: detects `skill` tool loads (source `tool`); first load wins, preserving `loadedAtStep`.
- `tool.execute.before`: increments `stepCount` for every tool except `skill`.
- Crossing-time review: when `stepCount - loadedAtStep > maxSteps`, writes `skillProblemStatement` via `addProblem` into the shared `sessionReview` key (deduped by `source:thresholdName`).
- State under `SessionStorage` namespace `skillUsageTracker`; thresholds from `.opencode/plugins/config/harness.config.ts` (`test-design` 8, `context-gathering` 12). Exported by `tool-limit-reminder` as `.tmp/session-review/<sessionID>/problems.md`.

## Dependencies / config
Helpers `./helpers/kv-store` (SessionStorage, FileSystemSessionStorageAdapter), `./helpers/logger`, `./helpers/review`, `./config/harness.config`.

## Retirement
Replaced by ADR-009 skill-usage-heuristics; no plugin replaces it. ADR-009 records the decision, the seven retained heuristics, and the reason (per-session only, no cross-session aggregation).

## Recovery
Recoverable from the git index at `.opencode/plugins-quarantine/skill-usage-tracker.ts`; recovered copy at `.tmp/retired-plugins/skill-usage-tracker.ts`; test `.opencode/plugins-quarantine/tests/skill-usage-tracker.test.ts`.

Source: recovered source `.tmp/retired-plugins/skill-usage-tracker.ts`; ADR-009 at `.tmp/adr/ADR-009-skill-usage-heuristics.md`.