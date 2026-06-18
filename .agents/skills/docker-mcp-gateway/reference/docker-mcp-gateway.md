# Reference: Docker MCP Gateway Technical Specifications

## Overview
The Docker MCP Gateway acts as a mediator between the AI agent and various MCP servers. It can manage remote connections via HTTP/SSE and local lifecycle management for Docker containers.

## Secret Injection Patterns

### 1. Docker Secrets
- **Mount Path**: `/run/secrets/`
- **Gateway Handling**: The gateway must be configured to read from these files if the environment variable is not provided directly.

### 2. Environment Variables
- **Scope**: Global to the gateway container.
- **Limitation**: Some gateway implementations might override `os.Environ()` during command execution. Always verify if the tool receives the variable.

### 3. Cloud Provider Auth
- For AWS/GCP/Azure, it is often more reliable to pass specific auth tokens (e.g., `AWS_CONTAINER_AUTHORIZATION_TOKEN`) directly to the gateway's command execution context.

## Catalog Schema Summary

| Server Type | Key Property | Description |
|---|---|---|
| **Remote** | `url` | The endpoint for the remote MCP server. |
| **Remote** | `transport_type` | Connection protocol (`sse`, `http`). |
| **Remote** | `headers` | **Must be nested** under the remote block. Used for `Authorization`, `X-API-Key`, etc. |
| **Docker** | `image` | The Docker image to pull and run. |
| **Docker** | `command` | Optional command to pass to `docker run`. |

## Known Issues & Caveats
- **Header Forwarding**: Some gateways may strip headers. If a tool is unreachable, verify that the `Authorization` header is being correctly injected.
- **Port Collisions**: When running multiple local Docker MCP servers, ensure the gateway assigns unique internal ports or handles the mapping correctly.
