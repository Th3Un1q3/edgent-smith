# Host-Side Diagnostics for the Embedded Daemon

The project devcontainer has NO docker CLI and NO `/var/run/docker.sock` — the gateway embedded daemon is invisible from inside it. All embedded-daemon inspection (ps, logs, images) must run on the HOST that runs the compose stack.

**Commands (run on the host that runs the compose stack)**:

- `docker compose -f .devcontainer/docker-compose.yml exec mcp_gateway docker ps -a` — spawned containers
- `docker compose -f .devcontainer/docker-compose.yml exec mcp_gateway docker logs <id>` — server logs
- `docker compose -f .devcontainer/docker-compose.yml exec mcp_gateway docker images` — image store
- Target the profile explicitly: `docker compose -f .devcontainer/docker-compose.yml up -d mcp_gateway` (service has `profiles: ["infra"]`)

**Environment facts**:

- Gateway endpoint from the devcontainer: `http://mcp_gateway:8080/mcp`; exercise catalog servers via `gateway_mcp-find` / `gateway_code-mode` / `gateway_mcp-exec` (a server must be enabled first — added via `mcp-add` or auto-started via `--enable-all-servers` — before a code-mode sandbox can exercise it).
- A TLS-intercepting proxy is configured only on the `devcontainer` service, NOT on `mcp_gateway` — registry pulls from the embedded daemon can fail on network/TLS if the host routes through a proxy.