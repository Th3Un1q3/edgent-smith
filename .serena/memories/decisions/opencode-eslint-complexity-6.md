---
id: decisions/opencode-eslint-complexity-6
type: claims
status: superseded
L0: "ESLint cyclomatic complexity capped at 6 (error) across the plugin tree, sources and tests; coverage is pinned per plugin subdirectory, not by an enumerated glob list."
hotness: 0.5
freshness: 2026-11-23
ttl: 180d
provenance: .opencode/eslint.config.js, scripts/verify_thresholds.sh
---
**Superseded by `mem:decisions/opencode-eslint-complexity`.**

# Decision
`.opencode/eslint.config.js` sets `complexity: ["error", { max: 6 }]` for the whole plugin tree — sources and tests alike (`**/plugins/**/*.ts`, `**/helpers/**/*.ts`, `**/types/**/*.ts`, plus `TEST_FILES`). Fix the complexity; do not release the ceiling.

# The stair is measured
The 7 -> 6 step cost 18 sites in 15 files, measured with the plugin lint over this tree, and `scripts/verify_thresholds.sh` pins that justification next to the rule. An earlier 8 -> 7 step preceded it. Whoever lowers the ceiling lands one step per iteration with its fallout fixed in the same iteration, so each change stays reviewable and reusable helpers surface. 5 is the next step and has not been measured: measure a candidate value before pinning it.

# The glob that lied
The complexity block once listed plugin subdirectories one by one and omitted `plugins/state-machine/**`: 26 files and 14 functions above complexity 7 resolved with no complexity rule while the block's comment claimed full coverage. The config author now writes one glob that expresses the intent rather than an enumerated list. `scripts/verify_thresholds.sh` (§6b) probes one file per plugin subdirectory and fails closed unless complexity resolves to error/max 6 there, so a later glob edit cannot drop a directory silently.

# Refactor rule of thumb
Extract domain-named predicates and guard clauses, one or two per site; replace dispatch switches with a lookup table; when the extracted function would push its source past the 350-line non-test cap, move it into a sibling module.

# Test rule
A repo-integrity test that pins a source expression (for example `gates.length < 5`) breaks on refactors that keep the rule. The test author asserts the rule and its failure message instead, and proves sensitivity by mutation.