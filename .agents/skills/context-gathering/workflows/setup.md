# Workflow: Setting Up Context-Gathering Tools

Know which gateway tools to call before any research.

## Discovery Keywords

- **Adopt direct-call rule:** The tools are already listed in the session under the gateway namespace — call the one that matches the need by name, with its real arguments: serena (`find_symbol`, `list_memories`), tavily (`tavily_search`), fetch (`fetch`), github (`get_file_contents`), deepwiki (`ask_question`), context7 (`query-docs`), devtools (`evaluate_script`). A name missing from there is hidden by a permission rule. For typed persistent memory see serena-memory/SKILL.md.

| Goal | Tool to call (by name, on the gateway namespace) | Server set |
|---|---|---|
| External research | `tavily_search`, then `fetch` or context7 `query-docs` | serena + tavily + fetch + context7 |
| GitHub issues | `search_issues`, then `get_file_contents` | serena + github + fetch |
| Browser/DevTools | `evaluate_script`, `click` | devtools + serena |
| Persistent memory (typed/gated) | Delegate to serena-memory | serena-memory/SKILL.md |

## Gateway pre-flight (MANDATORY) — copy-paste skeleton

> **Note:** The following are *gateway tool calls*, not shell commands. Call each by name on the gateway namespace, do NOT run in Bash.

```javascript
await tools.gateway["list_memories"]({}) // serena — a plain argument object, no wrapper
await tools.gateway["tavily_search"]({query: "pydantic-ai docs"}) // tavily — arguments carry the topic
// A name missing from the gateway namespace is hidden by a permission rule
// Allowing execute does NOT grant these tools — each has its own gateway_<tool> permission
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
2. **Discover tools:** see SKILL.md § Gateway pre-flight — the tools are already listed under the gateway namespace; a name missing from there is hidden by a permission rule.
3. **Selection**: Review descriptions, pick lightest server that covers the need.
4. **Call**: see SKILL.md § Gateway pre-flight — call the tool by name with a plain argument object, e.g. `tools.gateway["fetch"]({url})`.
5. **Verify**: Read the return — an empty or access-denied result means a permission rule, not a retry.
## Examples

> **Note:** The following are *gateway tool calls*, not shell commands. Call each by name on the gateway namespace, do NOT run in Bash.

```javascript
await tools.gateway["tavily_search"]({query: "vector database benchmarks"}) // web search
await tools.gateway["find_symbol"]({name_path_pattern: "edge_agent", relative_path: "agents", substring_matching: true}) // codebase symbol; matches build_edge_agent, run_edge_agent
// For persistent memory recall see serena-memory/workflows/store-memory.md — see SKILL.md § Gateway pre-flight
```

> Every tool call is a direct call on the gateway namespace — there is no discovery or activation step.
