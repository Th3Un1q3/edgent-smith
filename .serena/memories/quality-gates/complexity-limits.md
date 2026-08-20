# Complexity Limits

Established cyclomatic-complexity lint limits for this repo, enforced through the lint gates. Operator policy: violations are REFACTORED, never suppressed — `eslint-disable` comments are forbidden by the custom ban-disable rule and `# noqa` is not used. Rationale (operator): if something fails, fix it rather than release some rules.

## TypeScript (OpenCode plugins)

- ESLint core `complexity` rule in `.opencode/eslint.config.js` (flat config); blocks appended LAST so nothing overrides them, source block precedes test block:
  - `["error", { max: 8 }]` for plugin source: `plugins/*.ts`, `plugins/helpers/**`, `plugins/types/**`, `plugins/config/**`
  - `["error", { max: 8 }]` for plugin tests: `plugins/tests/**` (uniform with source)
- New rules under `.opencode/plugins/**` auto-enforce via the `opencode-lint` gate (`just .opencode/lint`).
- Tests tightened from max 15 → max 8 in a follow-up (Aug 2026), uniform with source. The ONLY violation was `defaultCreateClient` (cx 11 → 1) in `plugins/tests/helpers/mock-utilities.ts`, refactored via extraction of `resolveClientOptions`/`buildSessionData`/`resolveAgentList` — a proven pattern for refactoring complex test helpers (mock factory shape preservation).

## Python

- Ruff `C901` added to `[tool.ruff.lint] select` in `pyproject.toml`; `[tool.ruff.lint.mccabe]` sets `max-complexity = 10`.
- Ruff 0.15.x selector is `C901`, NOT `mccabe` (unrecognized).
- Enforced via the `python-lint` gate (`just lint`).

## Verifying the limits are live

- Resolved per-file thresholds: `eslint --print-config <file> | grep -A3 complexity` (ESLint 10 flat config).
- Negative controls prove a rule fires: run at a stricter threshold (max 1 / max-complexity 2) and violations appear; production threshold reports 0. Positive + negative checks together prove a rule is live end-to-end, not just declared.
- `bunx eslint --format json` output carries a `MODULE_TYPELESS_PACKAGE_JSON` warning prefix that breaks naive JSON.parse — filter with `grep -v Warning` or `2>/dev/null`. `--format compact` no longer exists in ESLint 10 core.

Refactor techniques that satisfy these limits: mem:refactoring/complexity-refactoring-patterns.