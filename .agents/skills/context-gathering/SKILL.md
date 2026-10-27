---
name: context-gathering
description: >
  Research libraries, frameworks, and tools; search the web for facts and documentation;
  explore codebases to find files, symbols, and references; and investigate GitHub
  repositories. Cache external knowledge and inject transient context for grounding.
  Trigger on: "research a library or tool", "find docs or facts", "explore the codebase", "investigate a GitHub repo", or any request needing context before acting (which is almost every task).
  Not for single-step factual lookups — an answer one direct tool call returns with no follow-up, no fetch-and-cache, and no synthesis; pure local code editing without a research component,
  or tasks covered by a more specific skill (e.g., devcontainers-best-practices, docker-mcp-gateway, building-pydantic-ai-agents, python-testing-patterns).
license: MIT
compatibility: Universal
metadata:
  version: "1.26.0"
  author: Th3Un1qu3
  delta: "1.26.0 — direct gateway tool calls; code mode no longer recommended."
  tools:
    - find_symbol
    - list_memories
    - tavily_search
---

# Context Gathering

Ground your responses, decisions, and code changes with external and internal context.

> Gateway tools are flat names on the gateway namespace, already listed in the session: call `tools.gateway["tavily_search"]({query: "..."})` with a plain argument object — no discovery or activation step.

## When Not to Use This Skill

Do not use this skill for:
- Pure local implementation/editing tasks with no research component.
- Tasks already covered by a more specific skill.

## Context Sources

- External — web pages, documentation, repositories; reliable knowledge beyond pre-trained assumptions.
- Internal — existing code, files, and dependencies; what exists and what a change might affect.
- Cache — transient research cache (`cache/{source}/...`) and synthesis; for persistent typed memory delegate to serena-memory.

## Minimal Workflow

- Read the relevant recipes for the task (see the flowchart below).

### Gateway pre-flight (MANDATORY)

- **Snapshot every large return:** cap each return to 2 KB (`s.length>2048? s.slice(0,2048)+"\n[...truncated]": s`). An empty/stderr return (`!raw || raw.trim() == ""`, `/Access denied/`, `content:[]`) is an infra flake, not a retry: fall back once to `bash cat .serena/memories/<id>.md` with 0 gateway retries, and complete recall only after `list_memories` -> `read_memory({memory_name: ids[0]})` returns the payload.
- The tools are already listed in the session under the gateway namespace — call one by name with real arguments, e.g. `tools.gateway["find_symbol"]({name_path_pattern: "edge_agent"})`; a name missing from the catalog may be hidden by a permission rule, so check the configured permissions before concluding the tool is unavailable.
- [Direct call shape and setup](./workflows/setup.md) — copy-paste call examples
- [Script rules and error handling](./workflows/scripting-workflow.md)

## Context Gathering Flows

Three entry points share one preamble (server-selection → call the chosen tool directly).

```mermaid
flowchart TD
    FindServers["Tools listed under gateway"] --> ReadSel["Read server-selection"]
    ReadSel --> Activate["Call tool by name, e.g. tools.gateway['tavily_search']"]
    Activate --> CheckCache["Check cache/{source}/..."]
    Activate --> SearchCode["Search codebase"]
    Activate --> CheckAccess["Publicly accessible?"]
    CheckCache -->|HIT sufficient| Respond["Respond from cache"]
    CheckCache -->|MISS/PARTIAL| Plan["Identify research plan"]
    Plan --> Query["Query external resources"]
    Query --> CacheWrite["Cache raw response"]
    CacheWrite --> Report["Report findings"]
    Query -->|auth/JS wall| DevTools["DevTools server"]
    SearchCode --> Output["Output result"]
    CheckAccess -->|yes| Query
    CheckAccess -->|no| DevTools
    DevTools --> CachedState{"Cache state?"}
    CachedState -->|sufficient| UseCached["Use cached"]
    CachedState -->|missing/outdated| RunBrowser["Run browser steps"]
    RunBrowser --> CachePrivate["Cache private/"]
    Query -->|blocking gate| Block{"Blocking gate?"}
    RunBrowser -->|login wall| Block
    Block -->|yes| Human["Human interaction"]
```
## Principles

- **Delegate persistent memory to serena-memory:** for typed, gated, disclosure-budgeted writes, Call serena-memory via Skill tool on serena-memory/SKILL.md — do not store persistent memories via context-gathering.
- **Persist findings, do not just report them:** end every research or inventory by storing its findings through serena-memory; a report carrying no `mem:` reference is incomplete. Acceptance is the memory name plus its read-back size in bytes.
- **Call tools, not servers:** the gateway namespace already lists the tools — serena, tavily, fetch, github, context7, deepwiki, devtools — so call the specific tool with real arguments instead of searching for a server.
- **Minimize round trips**: Batch independent tool calls in one `execute`; keep every call top-level and synchronous.
- **Scope the first search**: restrict the first codebase search to source directories with dependency and environment trees excluded (`.opencode/node_modules`, `.venv`, `.pnpm-store`); run a repo-wide pattern search only after a scoped search returns nothing. When [recipes/codebase-exploration.md](./recipes/codebase-exploration.md) is in use that recipe governs: its one-call `search_for_pattern` is the first search, an explicit exception to the scoped-first rule.
- **Trust server authentication**: Servers are credentialed; only devtools may need a login-wall probe.
- **Verify every write**: After any cache/file write read it back and confirm before reporting success.
- **Start with the lightest server**: Pick the default per category; escalate only on documented failure.
- **Cache external context**: Check `cache/{source}/...` before fetch; on miss store raw response with `mem:` refs.
- **Budget tool outputs**: Truncate every return to ≤2 KB in-script; read-backs ≤700 chars.
- **Batch execution gate**: ≤5 exec calls per batch → ≤2 entities per batch; checkpoint after each batch.
- **Output truncation gate**: Cap returns at 2 KB; do not return oversized outputs.
- **Smoke‑test extractors**: Validate on first entity before applying to batch.
- **Explicit negative constraints**: Include positive (“Use ONLY A”) and negative (“Do NOT use X,Y,Z”) instructions.

## Common Issues

- **Never read Serena files directly**: route every memory through the gateway chain; the only permitted direct read is the zero-retry `bash cat .serena/memories/<id>.md` fallback when the gateway returns empty.
- **No activation step**: the tools are already available on the gateway namespace; a name missing from the catalog may be hidden by a permission rule, so check the configured permissions before concluding the tool is unavailable.
- **Call the tool, not a server:** pass the tool's real arguments (`tavily_search` takes a query, never a topic or a server name); a missing name may be hidden by a permission rule, so check the configured permissions before concluding the tool is unavailable.
- **Top-level calls must be synchronous**: Async only inside devtools sandbox.
- **Write plain DOM JS**: No require/process/Buffer in browser realm.
- **Correct call shape**: `tools.gateway["<tool>"]({...args})` — a plain argument object, no `name`/`arguments` wrapper.

## Research decision tree

Pick one branch; for server choice see [references/server-selection.md](./references/server-selection.md).

- **Need persistent memory?** → Call serena-memory via Skill tool on serena-memory/SKILL.md first (recall/store), then context-gathering. _Example: "remember Alice's editor theme" → serena-memory preferences/editor/theme, then context-gathering to verify._
- **Need external fetch & cache verbatim?** → [recipes/external-content-caching.md](./recipes/external-content-caching.md) (tavily_extract). _Example: "cache <https://example.com/guide> verbatim" → cache/fetch/example-com/guide._
- **Need synthesis/research with mem: refs?** → [recipes/research-with-caching.md](./recipes/research-with-caching.md) (cache-check → fetch → synthesize). _Example: "research vector DB options" → researches/vector-db with mem: refs._
- **Need filesystem/codebase exploration?** → [recipes/filesystem-access.md](./recipes/filesystem-access.md) / [recipes/codebase-exploration.md](./recipes/codebase-exploration.md). _Example: "where is edge_agent defined?" → serena find_symbol._

## Task Routing Table

Every file appears here; pick the row that matches your task. The tree above decides the branch; this table resolves the file.

| I want to... | File |
|---|---|
| Choose which MCP server to use | [references/server-selection.md](./references/server-selection.md) |
| First time using the skill or need different MCP servers | [workflows/setup.md](./workflows/setup.md) |
| Call the gateway tool directly (code mode still available, no longer recommended) | [workflows/scripting-workflow.md](./workflows/scripting-workflow.md) |
| No ready-made recipe exists | [workflows/refinement-discovery.md](./workflows/refinement-discovery.md) |
| Explore local codebase | [recipes/codebase-exploration.md](./recipes/codebase-exploration.md) |
| Fetch & cache external content verbatim | [recipes/external-content-caching.md](./recipes/external-content-caching.md) |
| Synthesize research with mem: refs (cache-check → fetch → synthesize) | [recipes/research-with-caching.md](./recipes/research-with-caching.md) |
| Read/list/search/write files via gateway | [recipes/filesystem-access.md](./recipes/filesystem-access.md) |
| Understand a GitHub repository | [recipes/github-insights.md](./recipes/github-insights.md) |
| Automate a browser via devtools MCP | [workflows/browser-automation-devtools.md](./workflows/browser-automation-devtools.md) |
| Batch research tasks (5+ entities) | [recipes/batch-browser-automation.md](./recipes/batch-browser-automation.md) |
| Devtools tool facts | [references/devtools-known-issues.md](./references/devtools-known-issues.md) |
| Content fetch API formats | [references/content-fetch-api.md](./references/content-fetch-api.md) |
| Filesystem server API formats | [references/filesystem-server-api.md](./references/filesystem-server-api.md) |
| Truncation/budget examples | [references/truncation-examples.md](./references/truncation-examples.md) |
| Browser automation snippets | [references/snippets.md](./references/snippets.md) |
| Cache rulebook — budgets, key scheme, status lines | [references/caching-rules.md](./references/caching-rules.md) |
| Store/recall persistent memory — typed, gated, disclosure | [serena-memory/SKILL.md](../serena-memory/SKILL.md) |

## Invariants

- **Preserve invariants**: keep one authoritative home per fact, tag each memory with its typed scope before gating, and verify every write with the 9-check gate.
## Related Skills

- `serena-memory` — typed, gated persistent memory; Call serena-memory via Skill tool on serena-memory/SKILL.md for typed/gated persistent writes.
- `docker-mcp-gateway` — operates the gateway that hosts the `gateway_*` servers.
