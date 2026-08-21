# Complexity Limits

Cyclomatic-complexity lint limits for this repo, enforced through the lint gates. Operator policy: violations are REFACTORED, never suppressed — `eslint-disable` comments are forbidden by the custom ban-disable rule and `# noqa` is not used.

## TypeScript (OpenCode plugins)

- ONE merged ESLint core `complexity` block in .opencode/eslint.config.js (flat config): ['error', { max: 8 }] covering plugin source (**/plugins/*.ts), helpers/types/config, and tests uniformly. No per-scope split; no ordering constraint (no other block sets complexity).
- Pattern constants at the top of the file: allFiles, PLUGIN_ROOT = '**/plugins/*.ts', PLUGIN_TESTS = '**/plugins/tests/**/*.ts', TOP_LEVEL_TESTS = '**/tests/*.test.ts', TEST_FILES = [PLUGIN_TESTS, TOP_LEVEL_TESTS]. Rule blocks reference these consts — do not re-type literal globs.
- ESLint plugins actually in use: unicorn, typescript-eslint, @vitest/eslint-plugin, @stylistic/eslint-plugin. eslint-plugin-unused-imports was removed (declared, never imported) — do not add unused lint deps.
- Tests were tightened max 15 → max 8 (Aug 2026), uniform with source. The ONLY violation was defaultCreateClient (cx 11 → 1) in plugins/tests/helpers/mock-utilities.ts, refactored via extraction of resolveClientOptions/buildSessionData/resolveAgentList — a proven pattern for complex test helpers.
- New rules under .opencode/plugins/** auto-enforce via the opencode-lint gate (just .opencode/lint).

## Python

- Ruff C901 in [tool.ruff.lint] select; [tool.ruff.lint.mccabe] sets max-complexity = 10. Selector is C901, NOT mccabe (unrecognized).
- One per-file-ignore entry remains: "**/tests/**" = ["S101"]. Ruff uses Rust glob semantics where ** matches zero-or-more segments, so **/tests/** covers root-level tests/ too — the narrower "tests/**" entry was deleted as subsumed; keep only the broader entry.
- Enforced via the python-lint gate (just lint).

## Verifying the limits are live

- Resolved-config equivalence proves a config refactor behavior-neutral: diff bunx eslint --print-config <file> before/after. The Node MODULE_TYPELESS_PACKAGE_JSON stderr warning embeds mtime/PID (nondeterministic) — strip it (2>/dev/null or grep -v MODULE_TYPELESS) before diffing. --format compact no longer exists in ESLint 10 core.
- Per-file thresholds: eslint --print-config <file> | grep -A3 complexity (ESLint 10 flat config).
- Negative controls prove a rule fires: stricter threshold (max 1 / max-complexity 2) produces violations; production threshold reports 0. Positive + negative checks together prove a rule is live end-to-end.

Refactor techniques that satisfy these limits: mem:refactoring/complexity-refactoring-patterns.