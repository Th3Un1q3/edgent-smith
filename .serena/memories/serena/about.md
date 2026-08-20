# Serena Memory Store

Covers this project's serena memory store (`.serena/memories/`): file layout and format conventions, the `mem:` reference protocol, and tooling that reads the store (e.g. the memory-viz visualizer).

## Scope

- Store format facts: naming (= relpath minus `.md`), frontmatter shapes, `mem:` ref patterns and cleanup rules.
- Tooling around the store: memory-graph visualization.

## Boundaries (out of scope)

- The decision to structure memory this way - see `mem:architecture/adr/ADR-002-memory-system-and-structure`.
- Generic agentic memory patterns - see `mem:researches/agentic-patterns-memory-patterns`.
- Raw cached fetch content - lives in the cache domain.

## Related Domains

- `mem:testing` - where the memory-viz tool is tested.