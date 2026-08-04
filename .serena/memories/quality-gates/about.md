# Quality Gates

Covers the automated quality-gate system that runs checks against changed files during an editing session: the typed gate schema, the rules deciding which check runs on which file type, and how gate results reach the agent at runtime.

## Key Concepts

- **gate-configuration**: The `gates[]` TypeScript schema — gate name, trigger patterns, and the command sequence each gate runs.
- **design-rules**: How to decide which check belongs on which target — narrow triggers, no irrelevant checks, early exit, debounce.
- **runtime-behavior**: How gates fire on file changes, how results are tracked per session, and when a steering message is emitted.

## Related Domains

- `mem:refactoring/restructure-patterns` — Restructuring trips the lint and typecheck gates first; gate output drives the fix order.
- `mem:testing/test-consolidation` — Shapes what the test gate actually executes when source or test files change.
- `mem:refactoring/plugin-imports` — The class of import violation the lint gate is expected to catch.
