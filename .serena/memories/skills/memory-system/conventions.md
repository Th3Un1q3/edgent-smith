# Memory System Conventions

Standard conventions for naming, organizing, and cross-referencing memories in Serena.

## Naming Rules

- **Case-sensitive**: Memory names are case-sensitive. `skills/Architecture` and `skills/architecture` are different memories.
- **Hierarchical separator**: Use `/` to create topic groups. `skills/memory-system/overview` nests under `skills/memory-system/`.
- **No trailing slash**: Memory names should not end with `/`.
- **Lowercase preferred**: Use lowercase with hyphens for multi-word names (e.g., `write-patterns` not `writePatterns`).
- **No spaces**: Use hyphens instead of spaces in memory names.

## Granularity

- **One concept per memory**: Each memory should cover a single, focused topic.
- **Split by dimension**: A topic with multiple aspects gets multiple memories under a shared prefix.
- **Example pattern**: `skills/memory-system/overview`, `skills/memory-system/conventions`, `skills/memory-system/write-patterns` - three memories, one concept each.

## Cross-Referencing with `mem:`

- **Format**: `` `mem:topic/memory-name` `` inside memory content.
- **Automatic updates**: `rename_memory` automatically updates `mem:` references across all memories.
- **Navigation aid**: Use `mem:` links to create a navigable web of knowledge.
- **Read-only caution**: References in read-only memories are NOT updated on rename.

## Overview Memory Convention

- The parent topic should have an overview memory (e.g., `skills/architecture` for the `skills/` group).
- The overview serves as a table of contents with links to child memories.

## Topic Organization

```
topic/
  overview                  (table of contents for the group)
  subtopic-a/               (nested sub-group)
    overview
    detail-1
    detail-2
  subtopic-b
  subtopic-c
```

See `mem:skills/memory-system/overview` for tool details.
See `mem:skills/memory-system/write-patterns` for write strategies.