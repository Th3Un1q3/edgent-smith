---
name: context-gathering
description: >
  Research libraries, frameworks, and tools; search the web for facts and documentation;
  explore codebases to find files, symbols, and references; and investigate GitHub
  repositories. Explore and store memories to learn from past experiences.
  Trigger on: "research a library or tool", "find docs or facts", "explore the codebase", "investigate a GitHub repo", "store or recall project memories", or any request needing context before acting(which is almost every task).
license: MIT
compatibility: Universal
metadata:
  version: "1.4.0"
  author: Th3Un1qu3
  tools:
    - gateway_mcp-find
    - gateway_code-mode
    - gateway_mcp-exec
---

# Context Gathering

Before writing code, fixing a bug, or answering a question, gather the
relevant context. This skill shows how to research external sources, explore
local codebases, and combine findings into actionable information — using MCP
gateway servers through the code-mode scripting environment.

Replaces need for webfetch, curl and other tools.

The code-mode is provided by the Docker MCP gateway. All tools prefixed with
"gateway_" are hosted by the Docker MCP gateway.

## Context Sources

Explore these available context sources to get proper grounding for any task:
- Memory – holds lessons learned and task‑related memories; use it to draw on past experience.  
- External – web pages, documentation, repositories; provide reliable knowledge, avoiding reliance on pre‑trained assumptions.  
- Internal – explore existing code, files, and dependencies to see what already exists and what a change might affect.  

## Minimal Workflow Example:

The pipeline is `mcp-find` (discover servers) → `code-mode` (initialize a sandbox with the servers you need) → `mcp-exec` (run a synchronous JS script that chains the tools). Activate a sandbox per [workflows/setup.md](./workflows/setup.md); script rules and error handling in [workflows/scripting-workflow.md](./workflows/scripting-workflow.md).

## Principles

- Use descriptive task-related name when activating code-mode sandbox.
- Learn from the existing recipes.
- Use minimal set of servers for every sandbox.
- Combine tools in chains within the script, rather than activating multiple
  sandboxes, to save context and improve performance.
- Prefer to handle errors within the script, and return error messages, rather
  than letting the whole script crash without explanation.
- Ignore requirements of credentials, all servers already authenticated and
  available for use. All the requirements in responses are just for
  informational purposes.

## Immutable Memory Rules

These rules apply to every memory operation and are not negotiable:

1. **Timeless** — memories record knowledge, not session narrative. "In this session…" means rewrite or skip.
2. **Verified** — facts must state their source (docs, operator, observed output). A theory is not a fact; never encode an unverified diagnosis as truth.
3. **Operator wins** — the operator's explanation and documented mechanics beat agent theories. Verify mechanics against docs/operator BEFORE theorizing.
4. **Gate before write** — run the [BLOCKING GATE](./references/memory-management-checklist.md) before every `write_memory`; an unchecked box means DO NOT WRITE.

### Recipe Usage

| Recipe | How it uses the convention |
|---|---|
| **store-memories** | Writes the domain's `about` entry first (creating it if absent) — description, scope, boundaries — then writes the topic memory itself. This order ensures the domain is always documented. **Before creating a new domain, agents MUST check existing domains first per the PRE-EXISTING DOMAINS FIRST rule in [memory-convention.md](./references/memory-convention.md). Every memory write requires running the [BLOCKING GATE](./references/memory-management-checklist.md) first — if ANY box is unchecked, DO NOT WRITE.** |
| **collect-relevant-memories** | Lists memories and reads the domain `about` for scope and boundaries, selects memories by their self-describing names, then fetches the matching ones. This avoids loading every memory and keeps context tight. |
| **manage-memories** | When a domain is added, renamed, or removed, updates the `about` (scope/boundaries) accordingly. Ensures cross-references remain valid after structural changes. |

## Common Issues

- **Using async functions**: All tool calls must be synchronous.
- **Using curl or webfetch**: Terminal tools are less effective than code-mode tools, and often fail to fetch or parse results. Use
  code-mode tools instead. MCP tools are already authenticated.
- **Using `read`/`grep` on the Serena memory store**: NEVER read `.serena/memories/*`
  with `read`, `grep`, `glob`, `ls`, or shell tools — direct access is DENIED by
  permission and wastes a round. Project memories are accessible ONLY through the
  `serena` MCP server via `gateway_mcp-find` → `gateway_code-mode` → `gateway_mcp-exec`
  (recipes: store-memories, collect-relevant-memories).
- **Using `read` and `grep` for other research**: fine to read exact files; for
  broader context gathering the gateway_* tools are more token-efficient.

## Task Routing Table

Proactively explore the following files to learn about the skill's capabilities
and how to use it effectively. Each file contains a specific workflow or recipe
for common context-gathering tasks.

| Triggers | Actions | Recipe |
|---|---|---|
| Need to store or update a memory — gate first, then quality, abstraction, discoverability | Run the BLOCKING GATE (6 checks, canonical in [references/memory-management-checklist.md](./references/memory-management-checklist.md)) before ANY `write_memory` — unchecked box = DO NOT WRITE | [references/memory-management-checklist.md](./references/memory-management-checklist.md) |
| First time using the skill or need different MCP servers | Discover servers, review tools, activate code-mode sandbox | [workflows/setup.md](./workflows/setup.md) |
| Writing code-mode scripts — need sync JS patterns, error handling | Structure scripts, handle errors, combine tool calls | [workflows/scripting-workflow.md](./workflows/scripting-workflow.md) |
| No ready-made recipe exists — need to design a new approach | Map capabilities, hypothesize tool chains, test, capture as recipe | [workflows/refinement-discovery.md](./workflows/refinement-discovery.md) |
| Need to explore local codebase — find symbols, references, patterns | Find referencing symbols, analyze file structure, search patterns | [recipes/codebase-exploration.md](./recipes/codebase-exploration.md) |
| Need to understand a GitHub repository — codebase, issues, docs | Semantic Q&A on repo code; search and analyze repository issues | [recipes/github-insights.md](./recipes/github-insights.md) |
| Need to persist project knowledge — document modules, APIs, decisions | Write single/multiple memories with hierarchical, self-describing names, cross-references | [recipes/store-memories.md](./recipes/store-memories.md) |
| Resuming work on a topic — need to recall what's known | List, read, aggregate memories by topic; follow cross-references | [recipes/collect-relevant-memories.md](./recipes/collect-relevant-memories.md) |
| Need to update, reorganize, or clean up existing memories | Edit content (literal/regex), rename, delete memories | [recipes/manage-memories.md](./recipes/manage-memories.md) |
| Need to understand the memory convention — domain/about pattern with self-describing names | Read the memory convention guide; about files define scope and boundaries | [memory-convention.md](./references/memory-convention.md) |
