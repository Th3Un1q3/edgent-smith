# Bind & Mount Mechanics for Spawned Servers

Volume sources for server containers spawned by the gateway resolve against the mcp_gateway dind container's filesystem, NOT the host. A bind like `/workspace:/workspace:rw` carries real host data only when `/workspace` is also mounted into the mcp_gateway compose service; otherwise the container sees an empty auto-created directory. (Source: live probes + docker logs.)

The Rust filesystem server refuses to start when a positional allowed-dir argument does not exist in its container: docker log `Error: The path /workspace/.opencode is not a valid directory`. That error means the directory was not mounted into the dind namespace — fix the compose mounts, not the command. (Source: docker logs.)

Bind allowlists are not a strict gate in this gateway build: `MCP_GATEWAY_DOCKER_BIND_ALLOWED_PATHS` / `MCP_GATEWAY_DOCKER_BIND_ALLOW_WRITABLE_PATHS` (compose defaults: `/workspace`) still accepted an `/workspace:/workspace:rw` bind; enforcement appears lax/prefix-based in `docker/mcp-gateway:dind`. Do not treat the env allowlists as the enforcement layer — rely on mount modes (ro/rw) and server-side sandboxing, and verify empirically per build. (Source: live probe; compose env defaults.)

Refs: mem:docker-mcp-gateway/host-side-diagnostics (where to inspect dind state), mem:devcontainer-workflows/change-management (compose edit validation).