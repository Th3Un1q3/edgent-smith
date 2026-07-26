# CLI Domain Memory Index

The CLI domain documents the command-line interface architecture — Click-based routing, modular design, and shared service patterns.

## Memories

| Memory | Description |
|--------|-------------|
| `cli/architecture` — CLI entry point and command routing — modular design with Click |
| `cli/commands` — Command structure and organization across cli/commands/ |
| `cli/services` — Shared stateless service layer patterns |
| `cli/justfile` — Justfile task definitions and common workflow recipes |

## Cross-References

- `mem:agents/edge-agent` — agents invoked via CLI commands
- `mem:conventions/python` — Python 3.13 conventions in CLI code
