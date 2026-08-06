# DevTools MCP server: host-OS process pattern

chrome-devtools-mcp MUST run as a literal host-OS process — a sidecar or dind container cannot launch the host Chrome (operator-verified rule; the gateway connects to it as a remote catalog server). The host-side hook `initializeCommand` in `.devcontainer/devcontainer.json` delegates to a standalone, step-logged script (`sh .devcontainer/init.sh`), CI-gated so it never runs in CI.

## Launch (verified working)

- Launch line: `npx -y mcp-proxy@6.6.0 --port 9223 -- npx -y chrome-devtools-mcp@1.6.0 --autoConnect`
- `--autoConnect` only. `--browserUrl` is REDUNDANT: CLI docs show no yargs conflict between the flags (autoConnect conflicts only with isolated/executablePath; browserUrl only with wsEndpoint), but runtime proved the minimal flag set wins — `--autoConnect` alone works (operator: browserUrl unnecessary; verified live).
- Idempotent: launch only when port 9223 is not listening (`curl -s -m 1 -o /dev/null http://127.0.0.1:9223/mcp` fails).
- POSIX-safe detach: `( mkdir -p .tmp; nohup npx ... >> .tmp/devtools-mcp.log 2>&1 & )` — no `disown` (bash-only builtin → exit 127 under `/bin/sh` dash and FAILS the devcontainer start). Background fds point at the log so the CLI pipe is not held; exits 0 under dash and bash (verified empirically).
- The same hook appends `COMPOSE_PROFILES=infra` to `.devcontainer/.env` when absent (starts the infra-profile mcp_gateway/jaeger/serena services).

## Failure signatures

- **Silent launch failure** → Symptom: devtools catalog entry missing, empty or absent log. Cause: launch logic inline in initializeCommand with no step logging — the original inline hook captured nothing (operator). Fix: standalone `init.sh` with per-step timestamped logs to an agent-readable workspace path `<repo>/.tmp/devtools-mcp.log` (= `/workspace/.tmp/devtools-mcp.log` inside the container), never $HOME.
- **Host Node too old** → Symptom: `EBADENGINE` warnings, then `TypeError: Class extends value undefined is not a constructor or null` in `mcp-proxy/dist/stdio-*.mjs`. Cause: host Node below engines — mcp-proxy@6.6.0 requires node >=20; chrome-devtools-mcp@1.6.0 requires `^20.19.0 || ^22.12.0 || >=23` (observed failure: host Node v16.18.1). Fix: check `node --version` before wiring config. Fast check: compare `node --version` against those engine ranges.

## Hook semantics

- `initializeCommand` runs ON THE HOST only at container CREATE/REBUILD — a plain restart/attach re-runs nothing (empty log after restart ≠ no problem). Details: mem:devcontainer-workflows/lifecycle-hook-semantics.
- Test the hook shell under BOTH dash and bash before relying on it (devcontainers/cli runs hooks via `/bin/sh -c`).

## Architecture notes

- chrome-devtools-mcp is stdio-only (no `--port`/HTTP flag; verified v1.6.0), so mcp-proxy bridges it: streamable HTTP on `/mcp`, SSE on `/sse` (verified punkpeye/mcp-proxy README). mcp-proxy binds `::` by default — dual-stack on Linux accepts the docker bridge IPv4, so host.docker.internal works.
- Gateway integration: mcp_gateway carries `extra_hosts` mapping `host.docker.internal` → `host-gateway`; catalog entry `devtools` = `type: remote`, url http://host.docker.internal:9223/mcp, transport_type http (mirrors serena entry shape).

## Host prerequisites

- Host node/npx meeting engines (see failure signature above).
- Host Chrome running with remote debugging: `--remote-debugging-port` plus `--remote-debugging-address=0.0.0.0 --remote-allow-origins=*` for container-visible access; Chrome 144+ for `--autoConnect`.
- VERIFIED end-to-end: `list_pages` returned 10 live host-Chrome pages via gateway → proxy → mcp → CDP. Verify after changes: host-side `curl http://127.0.0.1:9223/mcp`; gateway-side `gateway_mcp-find devtools` after the gateway picks up the catalog.

Related: mem:devcontainer-workflows/lifecycle-hook-semantics, mem:devcontainer-workflows/host-side-service-launchers, mem:devcontainer-workflows/change-management, mem:researches/connecting-chrome-dev-tools-from-devcontainer
Adding a remote server like this triggers the decision-tree rule: update the context-gathering references/server-selection.md and references/content-fetch-api.md if it can serve a context-gathering need (mem:docker-mcp-gateway/server-addition).