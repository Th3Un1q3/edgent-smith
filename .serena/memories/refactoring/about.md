# Refactoring

Captures refactoring patterns, architectural decisions, and migration findings from codebase refactoring sessions — import architecture, dependency-change cascades, and code restructuring techniques, primarily in the TypeScript/OpenCode-plugin ecosystem with some Python module-move topics.

## Scope

- Refactoring patterns and techniques for reshaping code without behavior change: inner closures, boolean parameters, type narrowing, and fragile closure forward references.
- Import architecture: TypeScript `paths` alias resolution vs relative imports in plugin source, including how violations are detected and prevented.
- Dependency-change cascades: how downstream code breaks when shared modules change (type declaration merges, logger signature changes, mock factory chains) and how to contain the fallout.
- Static-analysis tradeoffs: lint-rule decisions that expose architectural constraints rather than style preferences.
- Process lessons: how to run multi-file refactoring sessions (see mem:refactoring/process/running-refactoring-sessions).
- Python module moves: relocating a module between layers behind a re-export shim, pinned by a guard test (topics prefixed `python-*`).
- Plugin runtime behavior as it drives refactoring decisions: hook lifecycle, SessionStorage-backed state, and test harness configuration.

## Boundaries (out of scope)

- Generic software-engineering advice with no refactoring grounding (style, naming, design-pattern theory).
- Runtime application logic for its own sake — hook dispatch, session state, and feature behavior belong in plugin feature knowledge unless documented as refactoring context (see mem:refactoring/plugin-lifecycle, mem:refactoring/permission-hooks).
- Testing strategy and test-writing knowledge — see mem:testing/about.
- Quality-gate schema, design rules, and runtime behavior — see mem:quality-gates/about.
- Skill and agent-workflow knowledge — see mem:skills/about.

## Key Concepts

- **Import architecture**: TypeScript `paths` aliases resolve only in test files; plugin source must use relative imports — including how violations are detected and prevented.
- **Dependency-change cascades**: How downstream code breaks when shared modules change (type declaration merges, logger signature changes, mock factory chains) and how to contain the fallout.
- **Code restructuring**: Patterns for reshaping plugin code without behavior change — inner closures, boolean parameters, type narrowing, and fragile closure forward references.
- **Static-analysis tradeoffs**: Lint-rule decisions that expose architectural constraints rather than style preferences (e.g., max-line violations).
- **Plugin runtime behavior**: Hook lifecycle, SessionStorage-backed state, and test harness configuration.
- **Process lessons**: How to run multi-file refactoring sessions effectively (see mem:refactoring/process/running-refactoring-sessions).
- **Python module moves**: Relocating a module between layers behind a re-export shim, pinned by a guard test.

NOTE: topics prefixed `plugin-*`/`alias-*` and the closure/lint items are TypeScript + OpenCode-plugin specific; Python topics are prefixed `python-*`.

## Related Domains

- mem:testing/test-consolidation — Test consolidation as a refactoring outcome.
- mem:quality-gates/configuration — Quality gates that catch regressions.
- mem:skills/general/context-gathering-tool-stack — Refactoring as a context-gathering workflow.