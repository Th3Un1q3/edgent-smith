# Testing

Scope: This domain covers project testing knowledge for BOTH the TypeScript stack (Vitest, Stryker mutation testing, Bun sandbox) AND the Python stack (pytest).

Knowledge here spans how test suites are structured and isolated, how mutation runs are scoped and tuned, and how sandbox-specific failures are diagnosed.

## Key Concepts

- **TypeScript plugin testing**: Vitest suites for OpenCode plugins — mock SessionStorage seams, phase-based TDD, hook pitfalls, and Bun APIs that break inside the Stryker sandbox.
- **Python testing**: pytest layout, the Click CLI invocation seam, agent isolation, and how the suite is executed.
- **Mutation and consolidation strategy**: scoping Stryker runs to changed modules, threshold interaction with equivalent mutants, and merging overlapping test files without losing coverage.

## Related Domains

- mem:refactoring/lint-tradeoffs — Lint fixes reveal architectural decisions; max-line decision tree.
- mem:refactoring/meta-lessons — Process insights from refactoring.
- mem:refactoring/side-effect-cascades — Cascade failures from test-related changes.
- mem:quality-gates/configuration — Mutation threshold in quality gates.
