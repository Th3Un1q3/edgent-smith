---
id: entities/opencode-plugin/retired-quality-gate-enforcer
type: entities
L0: "Retired v1 plugin quality-gate-enforcer: ran glob-matched quality gates before/after edit|write and posted steering results; migrated to a live v2 plugin."
hotness: 0.6
ttl: 90d
provenance: recovered source .tmp/retired-plugins/quality-gate-enforcer.ts; git index .opencode/plugins-quarantine/quality-gate-enforcer.ts
---

# quality-gate-enforcer (retired OpenCode v1 plugin)

## What it did in v1
Ran the quality gates matching a changed file and reported pass/fail transitions to the session as steering messages.

## Key behaviours / signals
- `tool.execute.before` and `tool.execute.after` hooks on targeted tools `edit`, `write`.
- `extractFilePath` makes `input.args.filePath` relative to the workspace root; `findMatchingGates` filters gates by `isGlobMatch(pattern, filePath)`.
- Gates loaded by `loadQualityGates()` (helpers/gate-config); executed via `runGate(gate, $)`; pooled by gate name (`pendingRuns`) with optional `debounceMs`.
- Status tracked in `gatesState` plus `SessionStorage`; only transitions (unknown→pass/fail) emit a message; `formatGateBatchResults` renders the batch.
- On the `task` tool after-hook, appends `⚠️ FAILING QUALITY GATES: ...` to a child session's output from persisted statuses.

## Dependencies / config
Helpers `./helpers/gate-config`, `./helpers/gate-runner`, `./helpers/glob-match`, `./helpers/kv-store`, `./helpers/session-helpers`, `./helpers/gate-formatter`, `./helpers/logger`; types `./types/quality-gate`.

## Retirement
Superseded by the live v2 plugin `.opencode/plugins/quality-gate-enforcer.ts`.

## Recovery
Recoverable from the git index at `.opencode/plugins-quarantine/quality-gate-enforcer.ts`; recovered copy at `.tmp/retired-plugins/quality-gate-enforcer.ts`; test `.opencode/plugins-quarantine/tests/quality-gate-enforcer.test.ts`.

Source: recovered source `.tmp/retired-plugins/quality-gate-enforcer.ts`; live plugin listed in `.opencode/plugins/`.