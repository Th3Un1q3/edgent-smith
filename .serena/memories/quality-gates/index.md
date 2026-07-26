# Quality Gates Domain Memory Index

The quality-gates domain documents the automated quality gate system — configuration schema, gate definitions, runtime behavior, and design rules.

## Memories

| Memory | Description |
|--------|-------------|
| `quality-gates/configuration` | Quality gate schema, existing gates for Python/TypeScript/Justfile targets, design rules |
| `quality-gates/design-rules` | Design rules for quality gates — narrow triggers, appropriate checks, sequential execution |

## Cross-References

- `mem:refactoring/plugin-imports` — lint gates that catch import violations
- `mem:skills/architecture` — how quality gates fit in the skill system
