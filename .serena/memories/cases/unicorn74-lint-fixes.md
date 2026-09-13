---
id: cases/unicorn74-lint-fixes
type: cases
L0: "Unicorn 71 to 74 new rules fixed at source, backward-compatible, no suppression"
hotness: 0.65
ttl: 180d
freshness: 2026-09-13
directory: cases
provenance: https://github.com/Th3Un1q3/edgent-smith/actions/runs/34761145832
---
# Unicorn 71 to 74 lint forward-fix

Requested as `refactoring/unicorn74-lint-fixes`, normalized to `cases/` prefix to pass Typed gate (9-type set).

Problem: Unicorn 71 to 74 introduced new and hardened rules. Source: eslint/unicorn changelog and `opencode-lint` 2 errors.

Solution: Source fix without suppression, backward-compatible: `consistent-boolean-name` renames to `isAfkActive`, `prefer-simple-condition-first` puts directory check first, `single-line-block-comment-style` normalizes comments. Source: operator report and lint diff.

Verification: Lint 0 errors, typecheck pass, test 523 pass, `just ci` 13 gates pass. Source: observed CI output.

Related: `mem:cases/ci-run-34761145832-dependabot-majors`
