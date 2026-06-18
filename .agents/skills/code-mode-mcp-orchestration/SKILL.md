---
name: code-mode-mcp-orchestration
description: >
  Effectively retrieve information about libraries, frameworks, tools, facts, and perform web searches. NEVER call any tool starting with "the_mcp" untill you have loaded this skill.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  author: Th3Un1qu3
---

# Code-Mode MCP Orchestration

This skill provides a structured workflow for leveraging external MCP servers (like Tavily, DeepWiki, or Context7) via the `code-mode` multi-tool scripting environment. It covers the entire lifecycle from initial discovery to final execution.

The code-mode is provided by docker mcp gateway. All the tools prefixed with "the_mcp" are hosted by the docker mcp gateway.

## When to Use This Skill

Invoke this skill when:
- You need to use external tools (web search, doc lookup) within a script.
- You are unsure how to register or configure a new MCP server.
- You want to understand the constraints and syntax of the `code_mode` tool.
- You need to build a complex multi-tool workflow in a single JS script.

## When Not to Use This Skill

Do not use this skill for:
- General application development that doesn't involve MCP tools.
- Editing existing production source code without a specific script-based use case.

## Minimal Workflow Example:

1. **Discover Servers**: `mcp-find({"query": "mcp"})` $\rightarrow$ finds all servers matching the query.
2. **Initialize Sandbox**: `code-mode({"name": "web-research", "servers": ["tavily"]})` creates an environment with all tools from the specified servers. Created environment can be used multiple times.
3. **Execute Tools**: Call `mcp-exec({"name": "code-mode_web-research"})` with the name "web-research"(from step 2) that and script:
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
- Combine tools in chains within the script, rather than activating multiple sandboxes, to save context and improve performance.
- Prefer to handle errors within the script, and return error messages, rather than letting the whole script crash without explanation.

## Task Routing Table

Load only the file relevant to the current task.

| I want to... | File |
|---|---|
| Find mcp servers and load MCP tools relevant to the task, learn tools available and create environment with tools | [workflows/setup.md](./workflows/setup.md) |
| Effectively script in code mode | [workflows/scripting-workflow.md](./workflows/scripting-workflow.md) |
| Handle a complex task with no ready-made recipe | [workflows/refinement-discovery.md](./workflows/refinement-discovery.md) |