# Skills Domain Memory Index

The skills domain documents the context-gathering skill system — how skills are structured, how recipes work, and how the Serena memory system itself is configured.

## Memories

| Memory | Description |
|--------|-------------|
| `skills/architecture` | How Docker MCP Gateway, code-mode, Serena, and skill definitions interconnect |
| `skills/recipe-structure` | Standard template for context-gathering skill recipes — overview tables, prerequisites, scripts, best practices, pitfalls |
| `skills/testing` | Live-testing methodology for verifying skill recipes, MCP server interactions, and memory operations against real servers |
| `skills/memory-system/overview` | The 6 Serena memory tools (write, read, list, edit, rename, delete) and their behavior |
| `skills/memory-system/conventions` | Naming rules, `mem:` cross-referencing, overview memory pattern, topic organization |
| `skills/memory-system/write-patterns` | Single writes, batch hierarchies, append patterns, overview+children pattern, defensive patterns |
| `skills/memory-system/manage-patterns` | Edit literal/regex, rename with cross-reference updates, delete with guard patterns |

## Cross-References

- `mem:quality-gates/configuration` — quality gate configuration
- `mem:refactoring/overview` — refactoring session overview
- `mem:refactoring/plugin-imports` — plugin import architecture
