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
  version: "1.3.0"
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

1. **Discover Servers**: `mcp-find({"query": "mcp, code, fetch, web"})` → finds
   all servers matching the query. Returns a list of matching servers.
2. **Initialize Sandbox**: `code-mode({"name": "web-research", "servers":
   ["tavily"]})` creates an environment with all tools from the specified
   servers. Created environment can be used multiple times.
3. **Execute Tools**: Call `mcp-exec({"name": "code-mode_web-research",
   "arguments": {"script": "# <synchronous js script>\nreturn \"hello word!\""}})`
   with the name "web-research"(from step 2) that and script:
```javascript

// Map tools having hyphens in their names to valid JS identifiers by replacing hyphens with underscores.
const tavilySearch = globalThis["tavily-search"]; // Tavily search was identified when initialized code-mode on step 2. Server with id tavily had a tavily-search tool.

// Use the tool, you could do multiple calls, and also manipulate the response as needed before returning it.
try {
  const searchResults = tavilySearch({ query: "How to configure Pydantic AI to work with ollama models" }); // Parameters schema was displayed at step 2. Always returns string(sometimes JSON stringified) so you can parse and manipulate as needed. But handle possible parsing errors when you expect JSON responses.
} catch (error) {
  // Prefer to display errors, and fallback if possible, rather than letting the whole script crash without explanation.
  return "ERROR from Tavily search: " + error.message;
}

// Here raw results from the tool can be returned, yet if you know the response structure, consider do some parsing, extracting, or formatting to return a cleaner/shorter output that is more likely to be useful for the user or the next steps in the workflow.
return {
  truncated: searchResults.slice(0, 400), // Usually for specific search results, the most relevant info is in the beginning of the response, so truncating can help fit more info in the context if needed.
  totalLength: searchResults.length // Just to understand how long the raw response is, and decide if further parsing or truncation is needed in the future.
}
```

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

### Recipe Usage

| Recipe | How it uses the convention |
|---|---|
| **store-memories** | Writes the domain's `about` entry first (creating it if absent), then updates the `index` entry with the new `mem:` reference, then writes the topic memory itself. This order ensures the domain is always documented and discoverable. **Before creating a new domain, agents MUST check existing domains first per the PRE-EXISTING DOMAINS FIRST rule in [memory-convention.md](./recipes/memory-convention.md). Validate every memory against the [Memory Quality Checklist](./references/memory-quality.md).** |
| **collect-relevant-memories** | Reads the domain's `index` to discover all `mem:` references within a domain, then fetches only the memories that match the current query. This avoids loading every memory and keeps context tight. |
| **manage-memories** | When a domain is added, renamed, or removed, updates the `about` and `index` entries accordingly. Ensures cross-references remain valid after structural changes. |

## Common Issues

- **Using async functions**: All tool calls must be synchronous.
- **Using curl or webfetch**: Terminal tools are less effective than code-mode tools, and often fail to fetch or parse results. Use
  code-mode tools instead. MCP tools are already authenticated.
- **Using `read` and `grep` tools for research**: "read" and "grep" tools fine to read exact files. For context gathering gateway_* tools and recipies much more token efficent and advanced for context gathering. Load recepis instead and follow them. 

## Task Routing Table

Proactively explore the following files to learn about the skill's capabilities
and how to use it effectively. Each file contains a specific workflow or recipe
for common context-gathering tasks.

| Triggers | Actions | Recipe |
|---|---|---|
| First time using the skill or need different MCP servers | Discover servers, review tools, activate code-mode sandbox | [workflows/setup.md](./workflows/setup.md) |
| Writing code-mode scripts — need sync JS patterns, error handling | Structure scripts, handle errors, combine tool calls | [workflows/scripting-workflow.md](./workflows/scripting-workflow.md) |
| No ready-made recipe exists — need to design a new approach | Map capabilities, hypothesize tool chains, test, capture as recipe | [workflows/refinement-discovery.md](./workflows/refinement-discovery.md) |
| Need to explore local codebase — find symbols, references, patterns | Find referencing symbols, analyze file structure, search patterns | [recipes/codebase-exploration.md](./recipes/codebase-exploration.md) |
| Need to understand a GitHub repository — codebase, issues, docs | Semantic Q&A on repo code; search and analyze repository issues | [recipes/github-insights.md](./recipes/github-insights.md) |
| Need to persist project knowledge — document modules, APIs, decisions | Write single/multiple memories with hierarchical naming, cross-references | [recipes/store-memories.md](./recipes/store-memories.md) |
| Resuming work on a topic — need to recall what's known | List, read, aggregate memories by topic; follow cross-references | [recipes/collect-relevant-memories.md](./recipes/collect-relevant-memories.md) |
| Need to update, reorganize, or clean up existing memories | Edit content (literal/regex), rename, delete memories | [recipes/manage-memories.md](./recipes/manage-memories.md) |
| Need to understand the memory convention — domain/about/index pattern | Read the memory convention guide and write about/index files | [recipes/memory-convention.md](./recipes/memory-convention.md) |
| Need to validate a memory before storing — quality, abstraction, redundancy | Check memory against the quality checklist before `write_memory` | [references/memory-quality.md](./references/memory-quality.md) |