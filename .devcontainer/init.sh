#!/bin/sh
# init.sh — bootstrap the host-side DevTools MCP server for the dev container.
#
# What it does:
#   1. Ensures .tmp/ exists and .devcontainer/.env carries COMPOSE_PROFILES=infra.
#   2. Safely stops any existing devtools mcp process on port 9223 (SIGTERM,
#      escalating to SIGKILL for survivors) and re-creates
#      chrome-devtools-mcp (stdio) bridged to HTTP by mcp-proxy on port 9223,
#      on the HOST machine.
#
# When it runs:
#   devcontainer.json invokes this via `initializeCommand`, which runs on the HOST
#   only when the dev container is CREATED or REBUILT (VS Code "Rebuild Container").
#   A plain `docker compose restart` does NOT trigger it. If the server is down
#   after a restart, re-run it manually from the repo root on the host:
#
#       sh .devcontainer/init.sh
#
#   Every run restarts the server: an existing listener on 9223 is killed first
#   so the freshly pinned versions are always used.
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

# --- Stop any existing devtools mcp process before (re)creating it. ---

# Collect the PIDs to stop: the listener on port 9223 plus any chrome-devtools-mcp
# workers (lsof covers the socket owner; fuser/pgrep are fallbacks for hosts
# without lsof and for the npx worker wrapper processes).
mcp_pids() {
  { lsof -ti tcp:9223 2>/dev/null; fuser -n tcp 9223 2>/dev/null; pgrep -f 'chrome-devtools-mcp' 2>/dev/null; } | sort -u
}

# Gracefully stop every collected PID: SIGTERM first, wait up to 5s, then SIGKILL
# any survivors so the port is always released and the server can be re-created.
stop_mcp() {
  pids=$(mcp_pids)
  [ -z "$pids" ] && { log 'no existing devtools mcp process found — skipping stop'; return 0; }

  log 'stopping existing devtools mcp process(es):'
  for pid in $pids; do
    kill -0 "$pid" 2>/dev/null || continue
    log "  SIGTERM -> pid $pid"
    kill -TERM "$pid" 2>/dev/null
  done

  survivors=''
  i=0
  while [ "$i" -lt 5 ]; do
    i=$((i+1))
    survivors=''
    for pid in $pids; do
      if kill -0 "$pid" 2>/dev/null; then
        survivors="$survivors $pid"
      fi
    done
    [ -z "$survivors" ] && break
    sleep 1
  done

  if [ -n "$survivors" ]; then
    for pid in $survivors; do
      log "  SIGKILL -> pid $pid"
      kill -KILL "$pid" 2>/dev/null
    done
  else
    log '  all devtools mcp processes exited'
  fi
}

stop_mcp

# Wait until port 9223 is actually free so the new server can bind to it.
i=0
while [ "$i" -lt 10 ]; do
  i=$((i+1))
  if ! lsof -i tcp:9223 >/dev/null 2>&1 && ! curl -s -m 1 -o /dev/null http://127.0.0.1:9223/mcp; then
    log 'port 9223 released'
    break
  fi
  sleep 1
done

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
