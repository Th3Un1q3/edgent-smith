# Docker MCP Gateway

Troubleshooting and operating the Docker MCP Gateway (`docker/mcp-gateway:dind`) that hosts the catalog MCP servers for the project devcontainer: image pull/start mechanics, server enablement (auto-start vs agent-add), agent tooling, and host-side diagnostics.

## Scope

- Image pull/start mechanics — the gateway pulls a container image when a server is added via `mcp-add`, NOT when a code-mode sandbox is created; container-backed (`type: server`) entries spawn as containers, `type: remote` entries connect over HTTP.
- Server enablement — a container-backed catalog server is usable only if it auto-starts (`--enable-all-servers` on gateway startup, activated via the Dev Container setup) or an agent adds it first via `mcp-add` (which triggers the image pull); agents must have the `mcp-add` tool in their toolset.
- Debugging process — how to diagnose gateway failures, researching the actual gateway mechanics (docs, operator configuration) before building low-level infrastructure theories.
- Host-side diagnostics for the gateway and its servers.
- Bind/mount mechanics — dind-namespace resolution of volume sources, server startup validation, bind-allowlist caveats.
- Security controls — digest pinning, `--block-secrets` semantics, `disableNetwork`.
- Catalog schema as verified in this build — flat `type: server` keys, env-based server configuration (e.g., `ALLOW_WRITE`).
- Server addition — the add-server rule requiring a context-gathering decision-tree update when the server can serve a context-gathering need (mem:docker-mcp-gateway/server-addition).

## Boundaries (out of scope)

- Canonical catalog schema, server-entry reference, and credentials — those live in the docker-mcp-gateway skill (`.agents/skills/docker-mcp-gateway/`); only verified-behavior deltas of the running build (schema drift, allowlist laxity, security-flag semantics) belong here.
- Devcontainer/compose change management — see mem:devcontainer-workflows/about.

## Related Domains

- mem:skills/general/filesystem-server-toolset — observed runtime behavior of the filesystem server the gateway spawns.
- mem:devcontainer-workflows/secrets-dependencies — pinning/secrets policy that this domain's security mechanics implement.
