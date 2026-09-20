---
id: cases/opencode/stryker_static_mutant_amplification
type: cases
L0: "Slow tests amplify Stryker runtime (about 50 percent static mutants re-run suites); fake timers + concurrency + timeout headroom, never weaken break"
hotness: 0.9
ttl: 180d
version: 1
freshness: 2026-09-19
directory: cases/opencode
provenance: .opencode/stryker.config.mjs
---
Failure: mutation runtime balloons because roughly 51% of mutants are static (no per-test coverage shortcut) and each static mutant re-runs the suite; one 2-3s test can add minutes.
Fixes: use fake timers or a small configurable grace instead of real multi-second waits; set Stryker concurrency to 100% (speed only; Stryker 9 removed maxConcurrentTestRunners); give MUTATION_TIMEOUT headroom.
Never weaken thresholds.break/high/low or set SKIP_MUTATION just to pass a run.
Measured: run time 6m24s -> 216s; mutation score 79.84 (break 72).
evidence: .opencode/stryker.config.mjs:34-47 and :52-58, scripts/ci.sh:13-14,77,87, justfile:37. Related non-duplicate: mem:cases/stryker10-vitests-separator.