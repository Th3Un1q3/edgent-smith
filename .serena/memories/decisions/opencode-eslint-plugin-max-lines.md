---
id: decisions/opencode-eslint-plugin-max-lines
type: claims
L0: "ESLint max-lines: non-test .opencode/plugins sources capped at 350 (skipBlankLines, skipComments); tests stay at 650 via a stepwise TODO."
hotness: 0.5
freshness: 2026-11-22
ttl: 180d
provenance: .opencode/eslint.config.js
---
# Decision
`.opencode/eslint.config.js` caps non-test plugin sources — the `allFiles` block that ignores `TEST_FILES`, covering root, `helpers/` and `types/` globs — at `max-lines` 350 with `skipBlankLines` and `skipComments`. The plugin test scope stays at 650.

# Why the test cap did not move
Three spec files measure above 550 effective lines (637, 633, 588 on 2026-11-22). The request pinned 350 to non-test files, so lowering the test cap in the same step would have forced speculative test refactors. The config TODO records the intended stepwise 650 -> 350 path, 100 lines at a time.

# Why the cap holds
Six sources above 350 were split into cohesive modules with unchanged public surfaces; no non-test plugin file now exceeds 350 effective lines. The cap is pinned: `scripts/verify_thresholds.sh` extracts the `max-lines` line after the `ignores: TEST_FILES` block and fails closed unless its max is exactly 350 with `skipBlankLines` and `skipComments` both true, and fails when the extraction is empty, so a later raise or a dropped flag breaks the gate.

# Deferred, with measurements
- complexity: owned by mem:decisions/opencode-eslint-complexity-6. The 8 -> 7 count recorded here (16 files, 22 violations, 2026-11-22) is disputed by a later record that reports a different figure, so a reader measures before reusing it.
- explicit-function-return-type: 43 files, 131 violations.
- no-floating-promises: needs type-aware parser options this config does not enable.

# Pre-existing, not caused by the cap
Ten goal-request prompt-template tests fail at HEAD because the tracked template text does not match the recorded expectation. The markdownlint MD047 fix was a one-byte trailing newline.