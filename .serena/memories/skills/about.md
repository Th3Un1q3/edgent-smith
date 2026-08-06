# Skills

Project-specific deltas and lessons learned about the agent skill system — the context-gathering tool stack (Docker MCP Gateway, code-mode sandboxes, Serena MCP server) and live-testing skill recipes against real servers.

## Scope

- Project-specific deltas: how the project's skills interconnect with the Docker MCP Gateway, code-mode, and Serena — what differs from the canonical skill guidance.
- Live-testing lessons: verifying skill recipes, MCP server interactions, and memory operations against real servers (return formats, anti-cheat validation).
- Gateway-hosted MCP server deltas — observed runtime behavior of servers used by skill recipes (filesystem toolset, error-as-result semantics, server-side sandboxing, content-fetch toolset (tavily, youtube-transcript), research-with-caching toolset (deepwiki, github, fetch)) that differs from documented tool lists.

## Boundaries (out of scope)

- Full skill guidance and canonical recipes — they live in `.agents/skills/*/SKILL.md`; this domain stores only project-specific deltas.
- Memory convention reference — the canonical convention lives in the context-gathering skill; only project-specific deltas belong here.

## Related Domains

- mem:quality-gates/configuration — Quality gate configuration for skill-related files.
- mem:testing/typescript/bun-apis-in-stryker-sandbox — Bun sandbox behavior relevant when testing skill recipes.
- mem:refactoring/plugin-imports — Plugin import architecture for OpenCode plugin development.
- mem:docker-mcp-gateway/about — gateway mechanics behind the servers the recipes exercise.
