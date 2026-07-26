# Refactoring Domain Memory Index

The refactoring domain captures patterns and architectural findings from codebase refactoring — structural changes, import architectures, cascade effects, and closure patterns.

## Memories

| Memory | Description |
|--------|-------------|
| `refactoring/overview` | Comprehensive refactoring session overview — 27 files, 16 subagent tasks, key outcomes |
| `refactoring/meta-lessons` | Process insights and lessons learned from earlier refactoring |
| `refactoring/plugin-imports` | Plugin import architecture — aliases are test-only, runtime vs test resolution |
| `refactoring/restructure-patterns` | Restructuring patterns for plugin code — inner closures, boolean parameters, type narrowing |
| `refactoring/side-effect-cascades` | Side-effect cascade patterns — type declaration merges, logger signature changes, mock factory chains |
| `refactoring/closure-forward-references` | Detecting and fixing fragile closure forward references |
| `refactoring/alias-enforcement` | Enforcing import alias rules between source and test files |
| `refactoring/lint-tradeoffs` | Lint fixes often reveal architectural decisions — max-line violation decision tree |

## Cross-References

- `mem:testing/consolidation` — test consolidation as a refactoring outcome
- `mem:quality-gates/configuration` — quality gates that catch regressions
- `mem:skills/architecture` — refactoring as a context-gathering workflow
