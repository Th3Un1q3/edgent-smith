# Connecting to a host Chrome instance from inside the devcontainer (CDP)

Goal: tools running inside the devcontainer reach a Chrome instance on the host machine through the Chrome DevTools Protocol (CDP) - the host Chrome's CDP endpoint is 127.0.0.1:58184 (operator-provided). All findings below are grounded in the cached tool responses listed under Cached sources.

## Result: config fix (devcontainer service)

Add to the devcontainer service in .devcontainer/docker-compose.yml:

    extra_hosts:
      - "host.docker.internal:host-gateway"

Why: the CDP server binds to 127.0.0.1 by default, so the container must reach the host through the docker bridge. Docker maps the special host-gateway value to the host internal IP, and host.docker.internal is the conventional hostname for it. Docker Desktop resolves host.docker.internal automatically, but on Linux hosts (this project: Linux devcontainer base image on the custom edgent-dev bridge network) the mapping must be explicit — hence extra_hosts. extra_hosts appends HOSTNAME=IP entries to the container /etc/hosts (compose short syntax; the = separator is preferred since Compose 2.24.1). The change lands on the devcontainer service only; mcp_gateway and other services stay untouched.

## Host-side Chrome launch

Launch a separate Chrome instance on the host with remote debugging on all interfaces:

    google-chrome --remote-debugging-port=58184 --remote-debugging-address=0.0.0.0 --remote-allow-origins=*

- --remote-debugging-port=58184 opens the CDP server on the operator's host Chrome (serves /json/version and /json/list, upgrades to WebSocket; 9222 is the docs' example port). This project's host Chrome is ALREADY running with remote debugging on 127.0.0.1:58184 (operator-provided) - no relaunch needed.
- --remote-debugging-address=0.0.0.0 makes it listen on all interfaces; without it the server binds 127.0.0.1 and is unreachable from the container.
- --remote-allow-origins is required since Chrome 111: the DevTools endpoint rejects WebSocket upgrades whose Origin is not whitelisted (403, "Rejected an incoming WebSocket connection ... Use the command line flag --remote-allow-origins=... to allow connections"). Use * for any origin, or a comma-separated origin list to tighten.
- Platform launch commands (Chrome docs): Linux google-chrome --remote-debugging-port=PORT; macOS open -a "Google Chrome" --args --remote-debugging-port=PORT; Windows start chrome --remote-debugging-port=PORT.

## Verify from inside the devcontainer

    curl -s http://host.docker.internal:58184/json/version
    curl -s http://host.docker.internal:58184/json/list

/json/version returns webSocketDebuggerUrl; connect a CDP/WebSocket client to that ws:// URL. Gotcha: Chrome rejects non-localhost Host headers with a 500 on /json/version — when the endpoint replies 500, retry with -H "Host: localhost" (observed in karakeep #2576; host.docker.internal is a hostname, so this workaround applies).

## Known issues (categorized from cached GitHub search results)

- Open bug: karakeep-app/karakeep #2576 — [Crawler] Persistent 500 on /json/version (Host header 'karakeep-chrome' rejected) — https://github.com/karakeep-app/karakeep/issues/2576. CDP rejects non-localhost/non-IP Host headers; workaround: send Host: localhost.
- Closed bug (fixed): AcePeak/naturo #1075 — bug: naturo browser launch omits --remote-allow-origins, so Chrome 111+ rejects the launcher's own CDP WebSocket (403, exact rejection message cached) — https://github.com/AcePeak/naturo/issues/1075. Fix: pass --remote-allow-origins (or *).
- Adjacent candidates from cached searches (not read in detail): browser-use/web-ui #306 (connection refused Errno 111), determined-ai/determined #8198, devcontainers/cli #927 (Proxy Settings).
- The repo-scoped search repo:microsoft/vscode remote debugging devcontainer 9222 returned only an unrelated folding issue (#9222) — no high-relevance VS Code issue exists for this.

## Validation ceiling

This research ran from the MCP gateway sandbox, which resolves host.docker.internal (to a sandbox-specific address) but has no host Chrome on the CDP endpoint (127.0.0.1:58184) — live verification must run on the user machine: apply the compose change, restart the devcontainer, launch Chrome with the flags above, then run the two curl commands from inside the devcontainer and connect a CDP client to the returned webSocketDebuggerUrl.

## Cached sources

Every cache entry below stores the raw tool response this synthesis is grounded in:

- mem:cache/deepwiki/chrome-devtools-protocol/remote-debugging-how-it-works — CDP server mechanics (/json/list, /json/version, WebSocket upgrade).
- mem:cache/deepwiki/chrome-devtools-protocol/launch-flags-remote-debugging — launch flags, 127.0.0.1 default bind, address override.
- mem:cache/deepwiki/chrome-devtools-protocol/remote-debugging-address-allow-origins — address + allowed-origins semantics.
- mem:cache/deepwiki/chrome-devtools-protocol/connect-from-container — VS Code remote-browser proxying / localhost rewriting angle.
- mem:cache/github/general/search-host-docker-internal-connection-refused — candidate connection-refused issues.
- mem:cache/github/general/search-remote-allow-origins-connection-failed — candidate --remote-allow-origins issues.
- mem:cache/github/general/search-host-gateway-devcontainer-linux — candidate host-gateway/devcontainer issues.
- mem:cache/github/microsoft-vscode/search-devcontainer-remote-debugging — repo-scoped search result set (no relevant hit).
- mem:cache/github/AcePeak-naturo/issue-1075 — Chrome 111+ origin rejection, exact error text, fix.
- mem:cache/github/karakeep-app-karakeep/issue-2576 — Host-header rejection on /json/version, workaround.
- mem:cache/fetch/code.visualstudio.com/docs-devcontainers-containers — devcontainer concept reference.
- mem:cache/fetch/developer.chrome.com/docs-devtools-remote-debugging-local-server — per-platform launch commands, port forwarding.
- mem:cache/fetch/docs.docker.com/engine-network-drivers-bridge — bridge network behavior.
- mem:cache/fetch/docs.docker.com/compose-file-05-services-extra_hosts — extra_hosts syntax, /etc/hosts entries.
- mem:cache/fetch/docs.docker.com/reference-cli-docker-container-run — host-gateway special value, host.docker.internal convention, Docker Desktop auto-resolution.
- mem:cache/fetch/docs.docker.com/desktop-features-networking — Docker Desktop networking page (thin capture; no host-gateway keywords found).
- mem:cache/fetch/github.com/ChromeDevTools-devtools-protocol — devtools-protocol repo landing page.
## DevTools MCP server (host process)

- The chrome-devtools-mcp server runs as a LITERAL HOST-OS PROCESS, not a compose container (a container cannot launch host Chrome). `.devcontainer/devcontainer.json` `initializeCommand` runs ON THE HOST, CI-gated by `if [ "${CI}" != "true" ]`, and idempotently launches the bridge: port-9223 curl check (`curl -s -m 1 -o /dev/null http://127.0.0.1:9223/mcp`) then detach `( mkdir -p .tmp; nohup npx -y mcp-proxy@6.6.0 --port 9223 -- npx -y chrome-devtools-mcp@1.6.0 --autoConnect --browserUrl http://127.0.0.1:58184 >> ".tmp/devtools-mcp.log" 2>&1 & )`; exits 0 under dash and bash (no `disown` — bash-only builtin that would exit 127 under /bin/sh dash; background fds point at the log) (missing host node/npx only logs; the log is <repo root>/.tmp/devtools-mcp.log - mkdir -p .tmp runs in the subshell - agent-readable at /workspace/.tmp/devtools-mcp.log since the repo root mounts at /workspace; --autoConnect + --browserUrl http://127.0.0.1:58184 verified against cached cli-options: no yargs conflict between them, autoConnect conflicts only with isolated/executablePath, browserUrl only with wsEndpoint). (VERIFIED: npm registry latest = 1.6.0, engines node ^20.19.0 || ^22.12.0 || >=23).
- chrome-devtools-mcp 1.6.0 is STDIO-only: no `--port`/HTTP transport flag exists (VERIFIED from src/bin/chrome-devtools-mcp-main.ts: `new StdioServerTransport()` + full cli-options.ts flag list). mcp-proxy (v6.6.0) bridges it to streamable HTTP on `/mcp` (README-verified default endpoint; SSE on `/sse`).
- The gateway reaches the host process as a REMOTE server: the `mcp_gateway` service carries `extra_hosts: ["host.docker.internal:host-gateway"]`, and catalog entry `devtools` in `mcp/catalog.yaml` (type: remote, url http://host.docker.internal:9223/mcp, transport_type http) mirrors serena. Prerequisite: host Chrome running with remote debugging enabled - operator endpoint 127.0.0.1:58184 (Chrome 144+ for --autoConnect); --browserUrl pins http://127.0.0.1:58184. General launch flags for container-visible access stay as-is where still true: --remote-debugging-address=0.0.0.0 --remote-allow-origins=*.
- Platform caveat: the mcp-proxy CLI exposes no `--host` flag (programmatic `startHTTPServer` `host` option only, default `"::"` per README). On typical Linux (bindv6only=0) the `::` bind is dual-stack and accepts IPv4 from the docker bridge, so host.docker.internal reaches it; Docker Desktop reaches host loopback directly.
- Gateway picks up the catalog change on its develop.watch restart (watches ../mcp) or manual restart. Verify host-side with `curl http://127.0.0.1:9223/mcp`; gateway-side with `gateway_mcp-find devtools` after the gateway restarts.

Sources: mem:cache/fetch/registry.npmjs.org/chrome-devtools-mcp-latest | mem:cache/fetch/github.com/ChromeDevTools-chrome-devtools-mcp | mem:cache/fetch/raw.githubusercontent.com/ChromeDevTools-chrome-devtools-mcp-main-src-bin-cli-options | mem:cache/fetch/raw.githubusercontent.com/ChromeDevTools-chrome-devtools-mcp-main-src-bin-mcp-main | mem:cache/fetch/raw.githubusercontent.com/punkpeye-mcp-proxy-main-README