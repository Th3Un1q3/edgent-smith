# Workflow: Setup and Discover MCP Servers

Follow this workflow to identify, register, and configure external MCP servers for use in your current session.

## Steps

1. **Identify Needs**: Determine which capabilities you are missing (e.g., web search, filesystem access, database queries).
2. **Discovery**: Run `mcp_find` with broad keywords to search the available MCP registry.
3. **Selection**: Review the `mcp_find` results. Check descriptions and server titles to find the best match for your needs.
4. **Registration**: Add the selected server to your session using `mcp_add`.
   - *Example*: `mcp_add(name: "tavily", activate: true)`
5. **Configuration**: If the server requires a configuration schema (e.g., API keys), set it using `mcp_config_set`.
6. **Verification**: Verify the server is active in your active toolset.

## Examples

**Searching for a web search tool:**
```javascript
// Run discovery
mcp_find(query: "web")
```

**Registering the found server:**
```javascript
// Register 'tavily'
mcp_add(name: "tavily", activate: true)
```

## Clarification Triggers

Ask the user before proceeding if:
- The server registration returns a "credential requires" message (explain that this is informational).
- Multiple servers match the same query (ask the user to choose one).
- A configuration schema is required but the user doesn't have the API key.
