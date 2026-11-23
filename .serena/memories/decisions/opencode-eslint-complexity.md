---
id: decisions/opencode-eslint-complexity
type: claims
status: active
L0: "Plugin cyclomatic complexity is capped at 4 (error) across the whole plugin tree; lower it one measured step at a time and simplify before extracting."
hotness: 0.7
freshness: 2026-11-23
ttl: 180d
provenance: .opencode/eslint.config.js, scripts/verify_thresholds.sh
supersedes: decisions/opencode-eslint-complexity-6
---
# Ceiling
`.opencode/eslint.config.js` sets `complexity: ['error', { max: 4 }]` for `**/plugins/**/*.ts`, `**/helpers/**/*.ts`, `**/types/**/*.ts` and `TEST_FILES`. That covers plugin entry files at the tree root, `helpers/{instructions,workflow,gates,runtime,session}`, `state-machine`, `sessions` and tests. The only deliberate exclusions are the global `**/*.d.ts` and `**/__mocks__/` ignores. Fix the complexity; do not raise the ceiling.

# Measured stair
The agent lowering the ceiling measures each step with the plugin lint before pinning it: 8 -> 7, 7 -> 6, 6 -> 5 (51 sites/33 files), 5 -> 4 (106 sites/51 files). Each step lands with its fallout fixed in the same iteration, and `scripts/verify_thresholds.sh` closes the coverage gap with a per-subdirectory resolution pin (§6b) plus an exact-4 assertion. The pin exists because an enumerated glob once dropped `plugins/state-machine/**`. The next decrement is unmeasured; measure a candidate before pinning it.

# Simplification before extraction
The user asked for this order explicitly. At an over-ceiling function the agent asks, in sequence: is the branch dead; does an existing helper or lookup table fit; is the value derivable; can two paths merge; can the condition be written once. Only then extract. Deletions and lookup tables cut more complexity than helper extraction did.

# Tests count
Test files sit under the same ceiling. The cheapest fix is table-driving near-identical cases or sharing a fixture; never delete a case to pass.

# Behaviour safety net
Several simplifications removed guards, and only the suite caught one regression (a settled/oversize publish path). Before touching a dispatcher or a restore routine, know which test covers it.
