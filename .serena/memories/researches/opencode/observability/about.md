# OpenCode Observability

How to observe opencode sessions and traces: OTel/telemetry export mechanics, what opencode persists (and does not), ready-made session viewers, and the Jaeger setup already wired into this repo’s devcontainer.

## Scope

- OpenCode OTel export config (env-var only), span inventory, and what is (not) instrumented.
- Persisted data: opencode.db SQLite schema + `opencode export` output; provider vs tool payloads.
- Ready-made viewers: cc-sessions-viewer, @virmont/opencode-viewer, Langfuse caveats.
- The repo’s Jaeger devcontainer wiring (compose service, env vars, port forwards) and opencode version pinning in the devcontainer feature.

## Boundaries (out of scope)

- Diagnosing opencode plugin runtime failures — see `mem:troubleshooting/about`.
- General devcontainer change mechanics — see `mem:devcontainer-workflows/about`.
- Docker MCP Gateway operations — see `mem:docker-mcp-gateway/about`.