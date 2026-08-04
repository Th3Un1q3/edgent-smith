# Testing

Covers project testing knowledge — Stryker mutation testing scoping, test file consolidation, OpenCode plugin mock patterns, and Bun sandbox pitfalls.

## Key Concepts

- **mutation-scoping**: Scoping Stryker mutation runs to changed modules; threshold interaction and equivalent mutants.
- **test-consolidation**: Pre-consolidation analysis, consolidation techniques (it.each, single preamble), and anti-patterns.
- **plugin-mock-patterns**: Mock SessionStorage patterns, phase-based TDD for plugins, and hook-related testing pitfalls.
- **bun-sandbox**: Bun-specific API calls vulnerable in the Stryker sandbox — root cause and fixes.

## Related Domains

- mem:refactoring/lint-tradeoffs — Lint fixes reveal architectural decisions; max-line decision tree.
- mem:refactoring/meta-lessons — Process insights from refactoring.
- mem:refactoring/side-effect-cascades — Cascade failures from test-related changes.
- mem:quality-gates/configuration — Mutation threshold in quality gates.
