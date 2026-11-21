---
id: cases/opencode/lint-gate-run-after-behaviour
type: cases
L0: "lint failed on consistent-function-scoping, no-top-level-side-effects and prefer-minimal-ternary only after tests were green, because the gate ran after the behaviour. Run the lint gate with each increment that moves code, not after tests pass."
hotness: 1.0
ttl: 180d
version: 1
freshness: 2026-11-19
directory: cases
status: active
provenance: "retrospective reported by the orchestrator of the 2026-11 state-machine run; confirmed by the three named lint errors on a diff whose tests were green"
claim_ids: []
---
# lint ran after the behaviour, so its failures arrived last

## Symptom
After tests were green, `lint` failed with three errors — `consistent-function-scoping`, `no-top-level-side-effects`, `prefer-minimal-ternary`. The gate had been run after the behaviour was finished rather than alongside it, so the failures surfaced at the end of the run instead of at the increment that caused them.

## False hypothesis
That green tests mean the change is complete and lint is a final cleanup pass — a formatting concern that cannot affect behaviour, so it can be deferred to the end.

## Root cause
Each rule is triggered by the shape of the new code at the moment it lands: a helper that closes over nothing, a module-level side effect, a ternary with more branches than needed. Scheduling the gate as a final phase left those shapes in the diff for the whole run, and the fix became a separate round touching code that tests had already blessed.

## How confirmed
The three named lint errors appeared on a diff whose test run was green, and each names new code rather than pre-existing code, so they were introduced by this change and were invisible to the test gate.

## Prevention
Run the lint gate after each increment that moves code, in the same step as that increment's test run, and reserve the end-of-run gate for the full suite and typecheck. A green test run is evidence about behaviour only, never about a lint-clean diff.