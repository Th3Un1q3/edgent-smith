# Workflow: Setting Up Context-Gathering Tools

Configure gateway servers before any research.

## Discovery Keywords

- **Adopt server-keyword rule:** Query gateway_mcp-find with server/capability keywords — serena (cache/lookup), tavily (web search), fetch (URL fetch), github (issues), deepwiki, context7 (library docs), devtools. DO NOT query topic/library names like `react` or `pydantic-ai`; those belong inside gateway_mcp-exec. For typed persistent memory see serena-memory/SKILL.md.

| Goal | gateway_mcp-find query (server capability keywords, not topic names) | Servers to activate |
|---|---|---|
| External research | "tavily fetch" then "deepwiki context7" | serena + tavily + fetch + context7 |
| GitHub issues | "github" | serena + github + fetch |
| Browser/DevTools | "devtools" | devtools + serena |
| Persistent memory (typed/gated) | Delegate to serena-memory | serena-memory/SKILL.md |

## Gateway pre-flight (MANDATORY) — copy-paste skeleton

> **Note:** The following are *gateway tool calls*, not shell commands. Execute via `gateway_mcp-find` → `gateway_code-mode` → `gateway_mcp-exec`, do NOT run in Bash.

```javascript
gateway_mcp-find query="serena"  // or "tavily", "fetch", "github" — finds SERVERS not answers
gateway_code-mode '{"name":"<unique>","servers":["serena"]}' // BOTH name+servers same call
// GOOD: '{"name":"serena-recall","servers":["serena"]}'
// BAD: '{"servers":["serena"]}' // missing name → silent fail
// BAD: gateway_mcp-find query="pydantic-ai docs" // topic not server
```
See SKILL.md § Gateway pre-flight for details — do not duplicate prose.

## Server Selection per Recipe

- **Recall persistent memories** — Delegate to serena-memory/workflows/recall-memory.md — serena-memory.
- **Research-with-caching** — serena + tavily + fetch + context7 — cache-check, fetch, store, synthesize.
- **External-content-caching** — serena + fetch/tavily — verbatim cache per URL.
- **DevTools** — devtools + serena — browser steps, cache in private/.

## Private vs Cache Scope

- **Verify scope**: Public→cache/{source}/..., private→private/cache/... — see serena-memory/references/disclosure.md for budgets and gating.md Privacy gate; public never mem:-link private.

## Steps

1. **Identify Needs**: Determine missing capability (web search, filesystem).
2. **Discover servers:** see SKILL.md § Gateway pre-flight — run gateway_mcp-find with server keyword (e.g., `tavily`, `fetch`, `github`).
3. **Selection**: Review descriptions, pick lightest server that covers the need.
4. **Activate**: see SKILL.md § Gateway pre-flight — call gateway_code-mode with BOTH name and servers in same call.
5. **Verify**: List tools in sandbox — confirm required tool present before gateway_mcp-exec.
## Examples

> **Note:** The following are *gateway tool calls*, not shell commands. Execute via `gateway_mcp-find` → `gateway_code-mode` → `gateway_mcp-exec`, do NOT run in Bash.

```javascript
gateway_mcp-find({query: "tavily"}) // web — finds SERVERS not answers
gateway_code-mode({name: "code-mode-research", servers: ["serena","tavily","fetch"]}) // BOTH name+servers
// For persistent memory activation see serena-memory/workflows/store-memory.md — see SKILL.md § Gateway pre-flight
```

> World queries run inside gateway_mcp-exec after activation — find discovers the server, exec queries the world.
