# Refactoring

Captures refactoring patterns, architectural decisions, and migration findings discovered during codebase refactoring sessions.

## Key Concepts

- **Import architecture**: TypeScript `paths` aliases resolve only in test files; plugin source must use relative imports — including how violations are detected and prevented.
- **Dependency-change cascades**: How downstream code breaks when shared modules change (type declaration merges, logger signature changes, mock factory chains) and how to contain the fallout.
- **Code restructuring**: Patterns for reshaping plugin code without behavior change — inner closures, boolean parameters, type narrowing, and fragile closure forward references.
- **Static-analysis tradeoffs**: Lint-rule decisions that expose architectural constraints rather than style preferences (e.g., max-line violations).
- **Plugin runtime behavior**: Hook lifecycle, SessionStorage-backed state, and test harness configuration.
- **Process lessons**: Meta-insights from past refactoring sessions on how to run them effectively.
- **Python module moves**: Relocating a module between layers behind a re-export shim, pinned by a guard test.

NOTE: topics prefixed `plugin-*`/`alias-*` and the closure/lint items are TypeScript + OpenCode-plugin specific; Python topics are prefixed `python-*`.

## Related Domains

- mem:testing/test-consolidation — Test consolidation as a refactoring outcome.
- mem:quality-gates/configuration — Quality gates that catch regressions.
- mem:skills/architecture — Refactoring as a context-gathering workflow.
