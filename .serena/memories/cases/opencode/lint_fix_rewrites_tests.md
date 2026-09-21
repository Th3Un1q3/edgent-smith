---
id: cases/opencode/lint_fix_rewrites_tests
type: cases
L0: "just lint runs eslint --fix and can rewrite test files; re-run tests after lint; avoid assigning built-in error properties (unicorn/no-error-property-assignment) in test helpers"
hotness: 0.8
ttl: 180d
version: 1
freshness: 2026-09-20
directory: cases/opencode
provenance: "Observed while adding workflow fork tests, .opencode, 2026-09-20"
---
# Lint --fix rewrites test files; re-run tests after lint
`just lint` in `.opencode` runs `eslint --fix`, so it can rewrite test files in place. A passing test run before lint does not prove the linted tree still passes.
- Always re-run tests after `just lint` (or run `just ci-fast` / `just ci`, which sequence them).
- Avoid assigning built-in error properties in test helpers: `error.name = 'AbortError'` trips `unicorn/no-error-property-assignment`.
- Build abort-like errors with `Object.defineProperty(error, 'name', { value: 'AbortError', configurable: true })` instead.
Anchor: `.opencode/plugins/tests/helpers/workflow-subtask-fork.test.ts` createAbortError.
Source: observed lint/test interaction.