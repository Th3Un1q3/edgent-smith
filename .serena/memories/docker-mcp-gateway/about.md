# Docker MCP Gateway

Troubleshooting and operating the Docker MCP Gateway (`docker/mcp-gateway:dind`) that hosts the catalog MCP servers for the project devcontainer: image pull/start mechanics, server enablement (auto-start vs agent-add), agent tooling, and host-side diagnostics.

## Scope

- Image pull/start mechanics — the gateway pulls a container image when a server is added via `mcp-add`, NOT when a code-mode sandbox is created; container-backed (`type: server`) entries spawn as containers, `type: remote` entries connect over HTTP.
- Server enablement — a container-backed catalog server is usable only if it auto-starts (`--enable-all-servers` on gateway startup, activated via the Dev Container setup) or an agent adds it first via `mcp-add` (which triggers the image pull); agents must have the `mcp-add` tool in their toolset.
- Debugging process — how to diagnose gateway failures, researching the actual gateway mechanics (docs, operator configuration) before building low-level infrastructure theories.
- Host-side diagnostics for the gateway and its servers.

## Boundaries (out of scope)

- Catalog server configuration details (server entries, YAML schema, credentials) — those live in the `docker-mcp-gateway` skill (`.agents/skills/docker-mcp-gateway/`).
- Devcontainer/compose change management — see mem:devcontainer-workflows/about.
