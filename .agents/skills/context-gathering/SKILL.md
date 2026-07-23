---
name: context-gathering
description: >
  Gather contextual information before making decisions or taking action. Research
  libraries, frameworks, and tools; search the web for facts and documentation;
  explore codebases to find files, symbols, and references; and investigate GitHub
  repositories. Uses MCP gateway servers (Tavily, DeepWiki, Context7) via code-mode
  scripting to fetch, parse, and combine results.
license: MIT
compatibility: Universal
metadata:
  version: "1.1.0"
  author: Th3Un1qu3
---

# Context Gathering

Before writing code, fixing a bug, or answering a question, gather the
relevant context. This skill shows how to research external sources, explore
local codebases, and combine findings into actionable information — using MCP
gateway servers through the code-mode scripting environment.

The code-mode is provided by the Docker MCP gateway. All tools prefixed with
"gateway_" are hosted by the Docker MCP gateway.

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
// Map tools having hyphens in their

const tavilySearch = globalThis["tavily-search"]; // Tavily search was identified when initialized code-mode on step 2. Server with id tavily had a tavily-search tool.

// Use the tool, you could do multiple calls, and also manipulate the response as needed before returning it.
try {
  const searchResults = tavilySearch({ query: "How to configure Pydantic AI to work with ollama models" }); // Parameters schema was displayed at step 2. Always returns string(sometimes JSON stringified) so you can parse and manipulate as needed. But handle possible parsing errors when you expect JSON responses.
} catch (error) {
  // Prefer to display errors, and fallback if possible, rather than letting the script crash without explanation.
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
- Use minimal set of servers for every sandbox.
- Combine tools in chains within the script, rather than activating multiple
  sandboxes, to save context and improve performance.
- Prefer to handle errors within the script, and return error messages, rather
  than letting the whole script crash without explanation.
- Ignore requirements of credentials, all servers already authenticated and
  available for use. All the requirements in responses are just for
  informational purposes.

## Common Issues

- **Using async functions**: All tool calls must be synchronous.

## Task Routing Table

Proactively explore the following files to learn about the skill's capabilities
and how to use it effectively. Each file contains a specific workflow or recipe
for common context-gathering tasks.

| I want to... | File |
|---|---|
| Set up context-gathering tools: discover MCP servers, learn available tools, and create a code-mode sandbox | [workflows/setup.md](./workflows/setup.md) |
| Write effective code-mode scripts to query, combine, and format results | [workflows/scripting-workflow.md](./workflows/scripting-workflow.md) |
| Handle a complex context-gathering task with no ready-made recipe | [workflows/refinement-discovery.md](./workflows/refinement-discovery.md) |
| Recipe: Get GitHub repository insights (stars, issues, README, recent commits) | [workflows/github_repository_insights.md](./workflows/github_repository_insights.md) |
| Explore your local codebase: symbol references, file analysis, pattern search, with tested recipes and known pitfalls | [recipes/codebase-exploration.md](./recipes/codebase-exploration.md) |
