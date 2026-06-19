# Workflow: Setup and Discover MCP Servers

Follow this workflow to identify, register, and configure MCP servers for use in your current session.

## Steps

1. **Identify Needs**: Determine which capabilities you are missing (e.g., web search, filesystem access, database queries).
2. **Discovery**: Run `mcp_find` with broad keywords to search the available MCP server. In case none of the servers found via broad queries, query "mcp" - this returns all servers.
3. **Selection**: Review the `mcp_find` results. Check descriptions and server titles to find the best matches for your needs.
4. **Review tools**: Activate code-mode with shortlisted servers, and review if activated code mode sandboxes have sufficent tools to execute task.


## Examples

**Searching for a web search tool:**
```
// Search servers related to web
mcp_find({query: "web"})


// If no servers found, query all MCP servers.
mcp_find({query: "mcp"})

// Read through names and descriptions, and select servers relevant to the task

// Activate code mode to see if necessary tools exist
code_mode({name: "task-related-name", servers: ["server 1", "server 2"]})

// Review tools available

// Optional: if tools in the code mode are not sufficent, and other server, may have relevant tools activate another code mode sandbox

code_mode(name: "task-related-name-2", servers: ["server-1", "server-3"])
```


