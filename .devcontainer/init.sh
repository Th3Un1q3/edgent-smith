#!/bin/sh
# init.sh — bootstrap the host-side DevTools MCP server for the dev container.
#
# What it does:
#   1. Ensures .tmp/ exists and .devcontainer/.env carries COMPOSE_PROFILES=infra.
#   2. Starts chrome-devtools-mcp (stdio) bridged to HTTP by mcp-proxy on port 9223,
#      on the HOST machine, unless something is already answering on port 9223.
#
# When it runs:
#   devcontainer.json invokes this via `initializeCommand`, which runs on the HOST
#   only when the dev container is CREATED or REBUILT (VS Code "Rebuild Container").
#   A plain `docker compose restart` does NOT trigger it. If the server is down
#   after a restart, re-run it manually from the repo root on the host:
#
#       sh .devcontainer/init.sh
#
# CI:
#   When CI=true the script logs and exits immediately — no server, no .env edits.
#
# Logs:
#   Timestamped output goes to .tmp/devtools-mcp.log (repo root, so the container
#   sees /workspace/.tmp/devtools-mcp.log). The launched server appends its own
#   output to the same file, so npx failures show up right after the launch marker.
#
# This script is POSIX sh (dash-safe: no arrays, no local, no disown) and ALWAYS
# exits 0 — a failure here must never block dev container creation.

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*" >> .tmp/devtools-mcp.log; }

# Log target first — tolerate failure (a broken .tmp must not block the container).
mkdir -p .tmp 2>/dev/null || true

log '==================================================================='
log 'init.sh starting'
log "pwd: $(pwd)"

# CI guard — never launch anything, never touch .env in CI.
if [ "${CI:-}" = "true" ]; then
  log 'CI=true — skipping'
  log 'init.sh done'
  exit 0
fi

# Ensure the infra compose profile is enabled for the sidecar services.
if grep -q '^COMPOSE_PROFILES=' .devcontainer/.env 2>/dev/null; then
  log 'COMPOSE_PROFILES already present in .devcontainer/.env — leaving unchanged'
else
  log 'COMPOSE_PROFILES not found in .devcontainer/.env — appending COMPOSE_PROFILES=infra'
  echo 'COMPOSE_PROFILES=infra' >> .devcontainer/.env
fi

# Idempotency probe: if the gateway already answers, there is nothing to do.
if curl -s -m 1 -o /dev/null http://127.0.0.1:9223/mcp; then
  log 'devtools mcp already responding at http://127.0.0.1:9223/mcp — skipping launch'
  log 'init.sh done'
  exit 0
fi

# npx must be on the host PATH; without it there is nothing sensible to do.
if ! command -v npx >/dev/null 2>&1; then
  log 'ERROR: npx not found on PATH — cannot start devtools mcp; install Node.js/npx on the host'
  log 'init.sh done'
  exit 0
fi

log 'Launching devtools mcp (detached):'
log '  ( nohup npx -y mcp-proxy@6.6.0 --port 9223 -- npx -y chrome-devtools-mcp@1.6.0 --autoConnect >> .tmp/devtools-mcp.log 2>&1 & )'
log 'Note: the first run downloads mcp-proxy and chrome-devtools-mcp via npx and can take a'
log '      while — watch this log for progress or errors from the background process.'

( nohup npx -y mcp-proxy@6.6.0 --port 9223 -- npx -y chrome-devtools-mcp@1.6.0 --autoConnect >> .tmp/devtools-mcp.log 2>&1 & )

log 'init.sh done'
exit 0
