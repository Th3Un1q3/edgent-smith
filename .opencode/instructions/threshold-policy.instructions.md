---
name: threshold-policy
description: "Enforce fail-closed threshold policy for coverage, mutation, lint, and config escapes."
applyTo: "{.opencode/stryker.config.mjs,.opencode/vitest.config.ts,.opencode/plugins/config/harness.config.ts,pyproject.toml,.opencode/eslint.config.js,.env.example,scripts/verify_thresholds.sh}"
---

# Threshold Policy — Fail-Closed Gates

Thresholds guard quality. Never lower a threshold to make CI pass. Fix the source.

## Guidelines

- **Never null**: `break: null` in `.opencode/stryker.config.mjs` is forbidden. Keep `break: 72`. Use `scripts/verify_thresholds.sh`, run as gate 0 inside the DevContainer by `just ci`, to block it.
- **Never warn**: Do not downgrade lint or type errors to `warn`. Keep `strict = true` in `pyproject.toml`, `no-eslint-disable` in `.opencode/eslint.config.js`, and 90/85 coverage in `vitest`/`harness` configs. Warn hides failures.
- **Never try:true**: Do not add `try: true` overrides in `.opencode/eslint.config.js`. Fix the violation at the source.
- **Never hide via .env.example**: Do not add `SKIP_MUTATION=1` or any active `SKIP_MUTATION=` assignment to `.env.example`. The fast path `SKIP_MUTATION=1 just ci` and `just ci-fast` is for local iteration only, not CI. CI runs `just ci` verbatim.
- **Fix source, not gate**: When a gate fails, change production or test code to meet the threshold. Do not edit `stryker.config.mjs`, `vitest.config.ts`, `harness.config.ts`, `pyproject.toml`, or `eslint.config.js` to lower the number.
- **Requires justification + measurement**: Any threshold change needs a written justification and a measurement. Record the before/after score, the reason (e.g., new module with different risk), and the data. Get review. Without both, the change is rejected.

## Step-by-Step Workflow

1. **Reproduce**: Run `bash scripts/verify_thresholds.sh` and `just verify-agents`. Confirm Gate #0 fails closed.
2. **Measure**: Run the failing gate in isolation (`just test --coverage`, `just .opencode/mutation`, `just lint`, `just typecheck`). Capture numbers.
3. **Fix source**: Edit implementation or tests until numbers meet the pinned threshold. Do not edit threshold files.
4. **If a threshold must move**: Write justification (why, risk, alternative) and attach measurement (before/after). Update `scripts/verify_thresholds.sh` pin and `.opencode/stryker.config.mjs` / `vitest` / `harness` together. Run `bash scripts/verify_thresholds.sh` and `just ci-fast`.
5. **Pre-push**: `scripts/install-hooks.sh` installs `.githooks/pre-push` which runs `just verify-agents && just ci-fast`. Do not push with `--no-verify`; remote CI runs `scripts/verify_thresholds.sh` as gate 0 inside the DevContainer and blocks bypasses.

## Output Format

- Keep thresholds pinned: Stryker `break: 72`, Vitest `90` (branches/functions/lines/statements), Harness `85`, `mypy strict=true`, `ruff max-complexity 10`, `MUTATION_TIMEOUT` present.
- Keep escapes absent: no `break: null`, no `SKIP_MUTATION=` in `.env.example`, no `try: true` in `eslint.config.js`, no `ignore_missing_imports`.
- Verification is `bash scripts/verify_thresholds.sh` → `PASS` and `just verify-agents` → `PASS` and CI gate 0 `verify-thresholds` → `PASS`.

## Branch Protection and Hooks

- Branch protection requires CI `ci` job success. Direct push with `--no-verify` still hits CI gate 0 (`verify-thresholds`, inside the DevContainer).
- Install hooks once per clone: `bash scripts/install-hooks.sh`. Re-run after `git clone` or when `.githooks/pre-push` changes.
- Fork-PR prebuild guard stays: `prebuild-devcontainer` skips on forks, `ci` runs with `always() && (success || skipped)`.
