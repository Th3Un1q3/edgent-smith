# Research & Documentation-Search Process — SUPERSEDED

> **SUPERSEDED 2026-09-01 — moved to mem:skills/research/about per OpenViking typed-scope consolidation.**
> This about is retained as a pointer so existing mem:research-process/* refs resolve. New content goes to mem:skills/research/*.

## Moved topics
- mem:research-process/conflict-resolution → mem:skills/research/conflict-resolution
- mem:research-process/permission-aware-probing → mem:skills/research/permission-aware-probing
- mem:research-process/software/finding-known-github-issues → mem:skills/research/software/finding-known-github-issues

## Original content (archived)
# Research & Documentation-Search Process

Process learnings for documentation research, web/GitHub-issue exploration, and validation probing inside orchestrator-driven sessions.

**Use when:** researching a library/tool, reading docs, searching GitHub issues, running probes/tests to verify behavior.

## Scope

- Research and context-gathering process knowledge: finding known GitHub issues, exploring official docs, auditing docs after renames.
- Settling conflicting claims between sources via decisive empirical tests.
- Permission-aware probing — running probes, HTTP checks, and git commands inside a permissioned sandbox.

## Boundaries (out of scope)

- Tool mechanics of the context-gathering stack (Docker MCP Gateway, code-mode sandboxes, Serena MCP server) — project deltas live in `skills/`; full guidance in the context-gathering skill.
- Devcontainer/compose workflow knowledge — see mem:devcontainer-workflows/about.
- Sub-agent orchestration and verification — see mem:subagent-workflows/about.

## Related Domains

- mem:subagent-workflows/about — how research tasks get dispatched and verified.
- mem:devcontainer-workflows/about — research performed while changing dev environments.
