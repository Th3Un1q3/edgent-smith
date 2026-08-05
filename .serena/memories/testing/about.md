# Testing

Covers project testing knowledge for both the TypeScript stack (Vitest, Stryker mutation testing, Bun APIs in the Stryker sandbox) and the Python stack (pytest): how test suites are structured and isolated, how mutation runs are scoped and tuned, and how sandbox-specific failures are diagnosed.

## Scope

- TypeScript plugin testing: Vitest suites for OpenCode plugins — mock SessionStorage seams, phase-based TDD, hook pitfalls, and Bun APIs that break inside the Stryker sandbox (see mem:testing/typescript/bun-apis-in-stryker-sandbox).
- Python testing: pytest layout, the Click CLI invocation seam, agent isolation, and how the suite is executed.
- Mutation and consolidation strategy: scoping Stryker runs to changed modules, threshold interaction with equivalent mutants, and merging overlapping test files without losing coverage.

## Boundaries (out of scope)

- Generic testing theory, frameworks, and TDD methodology — covered by the skills/testing skill; only project-specific application belongs here.
- Non-testing knowledge: refactoring patterns and processes (see mem:refactoring/about), quality-gate schema, design rules, and runtime behavior (see mem:quality-gates/about).
- Skill and agent-workflow guidance (see mem:skills/about).

## Key Concepts

- **TypeScript plugin testing**: Vitest suites for OpenCode plugins — mock SessionStorage seams, phase-based TDD, hook pitfalls, and Bun APIs that break inside the Stryker sandbox.
- **Python testing**: pytest layout, the Click CLI invocation seam, agent isolation, and how the suite is executed.
- **Mutation and consolidation strategy**: scoping Stryker runs to changed modules, threshold interaction with equivalent mutants, and merging overlapping test files without losing coverage.

## Related Domains

- mem:refactoring/lint-tradeoffs — Lint fixes reveal architectural decisions; max-line decision tree.
- mem:refactoring/process/running-refactoring-sessions — Process insights from refactoring.
- mem:refactoring/side-effect-cascades — Cascade failures from test-related changes.
- mem:quality-gates/configuration — Mutation threshold in quality gates.