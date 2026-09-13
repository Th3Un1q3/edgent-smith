---
id: cases/stryker10-vitests-separator
type: cases
L0: "Stryker 10 space-join vs Vitest 5 greater-join yields 0 tests per mutant, use evidenced hold"
hotness: 0.7
ttl: 180d
freshness: 2026-09-13
directory: cases
provenance: https://github.com/Th3Un1q3/edgent-smith/actions/runs/34761145832
---
# Stryker 10 vs Vitest 5 separator mismatch

Requested as `troubleshooting/stryker10-vitests-separator`, normalized to `cases/` prefix to pass Typed gate (9-type set).

Problem: Stryker 10 runner space-joins test file args while Vitest 5 expects `>`-join, producing 0 tests per mutant and covered 0.00. Docs state `coverageAnalysis` is ignored. No repo knob exists. Source: observed mutation log 0.07 and Stryker docs.

Solution: Apply evidenced hold pattern — pin compatible runner versions, document separator mismatch, avoid symptom patching. Source: operator report.

Verification: Mutation recovers to 85.57 after holds plus lint forward-fix, confirmed by `just ci` 13 gates pass. Source: observed CI output.

Related: `mem:cases/ci-run-34761145832-dependabot-majors`
