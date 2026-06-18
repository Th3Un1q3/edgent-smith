# Workflow: MCP Catalog Configuration

This workflow explains how to correctly structure your `mcp/catalog.yaml` file for various server types.

## Remote Server Syntax
Remote servers use the `remote` (or `connection`) block. **Crucially, `headers` must be nested inside this block.**

### Example: Remote HTTP/SSE Server
```yaml
my-remote-tool:
  type: remote
  description: "Remote search tool"
  title: "Remote Search"
  remote:
    url: "https://api.example.com/mcp"
    transport_type: "sse"
    headers:
      Authorization: "Bearer ${API_KEY}"
```

## Docker-Based Server Syntax
For servers running as local Docker containers, the gateway manages the lifecycle.

### Example: Local Container Tool
```yaml
local-docker-tool:
  type: docker
  description: "Local container tool"
  title: "Local Tool"
  docker:
    image: "mcp/web-search"
    # Optional: pass extra args to the container
    command: ["--port", "8080"]
```

## Best Practices
- **Use Variable Expansion**: Use `${VAR_NAME}` for secrets to keep the catalog file clean and portable.
- **Transport Types**: Always specify `transport_type` (e.g., `sse`, `http`) to ensure the gateway uses the correct connection logic.
- **Comments**: Add descriptions to every entry in the catalog to help other agents understand the tool's purpose.
