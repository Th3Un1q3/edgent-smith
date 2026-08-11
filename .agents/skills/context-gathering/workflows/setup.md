# Workflow: Setting Up Context-Gathering Tools

Follow this workflow to identify, register, and configure context-gathering tools for your current session.

## Steps

1. **Identify Needs**: Determine which capabilities you are missing (e.g., web search, filesystem access, database queries).
2. **Discovery**: Run `gateway_mcp-find` with broad keywords to search the available MCP server. In case none of the servers found via broad queries, query "mcp" - this returns all servers.
3. **Selection**: Review the `gateway_mcp-find` results. Check descriptions and server titles to find the best matches for your needs.
4. **Review tools**: Activate code-mode with shortlisted servers, and review if activated code mode sandboxes have sufficent tools to execute task.

## Examples

**Searching for a web search tool:**
```
// Search servers related to web
gateway_mcp-find({query: "web"})


// If no servers found, query all MCP servers.
gateway_mcp-find({query: "mcp"})

// Read through names and descriptions, and select servers relevant to the task

// Activate code mode to see if necessary tools exist.
// The `name` parameter is REQUIRED — it is the sandbox name (descriptive, task-related, e.g., code-mode-<task>).
// The activation returns the prefixed tool name to use in gateway_mcp-exec — never substitute arbitrary text.
gateway_code-mode({name: "code-mode-web-research", servers: ["tavily", "fetch"]})

// Review tools available

// Optional: if tools in the code mode are not sufficent, and other server, may have relevant tools activate another code mode sandbox

gateway_code-mode({name: "code-mode-web-research-github", servers: ["github", "deepwiki"]})
```
