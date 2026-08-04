# Quality Gates

Covers the automated quality gate system — configuration schema, gate definitions for Python, TypeScript, and Justfile targets, and design rules for narrow triggers and appropriate checks.

## Key Concepts

- **gate-configuration**: Quality gate schema and existing gates for Python, TypeScript, and Justfile targets.
- **design-rules**: Narrow triggers, appropriate checks, and sequential execution for gates that run on relevant file changes.
- **steering-messages**: Runtime behavior and steering message patterns when gates fail.

## Related Domains

- mem:refactoring/plugin-imports — Lint gates that catch import violations.
- mem:testing/mutation-scoping — How the mutation threshold gate is scoped to changed modules.
- mem:skills/architecture — How quality gates fit in the skill system.
