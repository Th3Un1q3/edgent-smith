# Quality Gates

Covers the automated quality-gate system that runs checks against changed files during an editing session: the typed gate schema, the rules deciding which check runs on which file type, and how gate results reach the agent at runtime.

## Scope

- Gate schema: the `gates[]` TypeScript schema — gate name, trigger patterns, and the command sequence each gate runs.
- Design rules: how to decide which check belongs on which target — narrow triggers, no irrelevant checks, early exit, debounce.
- Runtime behavior: how gates fire on file changes, how results are tracked per session, and when a steering message is emitted.

## Boundaries (out of scope)

- Generic CI/CD knowledge — pipeline design, hosting, and tooling unrelated to this gate system.
- Gate-plugin implementation details (plugin hooks, lifecycle, permission rules) — those belong in the refactoring plugin topics (see mem:refactoring/plugin-lifecycle, mem:refactoring/permission-hooks).
- Testing strategy for the checks themselves — see mem:testing/about.

## Key Concepts

- **gate-configuration**: The `gates[]` TypeScript schema — gate name, trigger patterns, and the command sequence each gate runs.
- **design-rules**: How to decide which check belongs on which target — narrow triggers, no irrelevant checks, early exit, debounce.
- **runtime-behavior**: How gates fire on file changes, how results are tracked per session, and when a steering message is emitted.
- **complexity-limits**: Established cyclomatic-complexity thresholds for the lint gates — ESLint `complexity` max 8 (plugin source and tests, uniform), Ruff C901 max 10.

## Related Domains

- `mem:refactoring/restructure-patterns` — Restructuring trips the lint and typecheck gates first; gate output drives the fix order.
- `mem:testing/test-consolidation` — Shapes what the test gate actually executes when source or test files change.
- `mem:refactoring/plugin-imports` — The class of import violation the lint gate is expected to catch.