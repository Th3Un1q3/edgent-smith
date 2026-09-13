---
id: cases/ci-run-34761145832-dependabot-majors
type: cases
L0: "CI 34761145832: PR28 dependabot majors broke lint+mutation, fixed via source forward-fix and holds"
hotness: 0.85
ttl: 180d
freshness: 2026-09-13
directory: cases
provenance: https://github.com/Th3Un1q3/edgent-smith/actions/runs/34761145832
claim_ids: [claims/ci-34761145832-verification]
---
# CI run 34761145832 — dependabot majors root-cause fix

Problem: PR 28 bumped 4 majors in `.opencode/package.json`, breaking `opencode-lint` with 2 errors and dropping `opencode-mutation` to 0.07. Source: GitHub Actions run 34761145832 observed output.

Solution: Forward-fixed lint source with 2 manual plus 11 auto-fix changes, held compat trio to 9.6.1/4.x with dependabot ignores, kept eslint/unicorn majors. Addresses underlying incompatibility, not symptom. Source: operator report and `just ci` log.

Verification: lint 0 errors, typecheck pass, test 523 pass at 99.28 percent, mutation 85.57 (threshold 72), `just ci` 13 gates pass, `verify_thresholds` 46 pass. Source: observed CI output.

Related: `mem:cases/stryker10-vitests-separator`, `mem:cases/unicorn74-lint-fixes`
