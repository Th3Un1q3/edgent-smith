# Host-Side Service Launchers (general pattern)

Checklist for wiring ANY service that must run as a literal host-OS process from the repo — e.g. a tool that must drive the host Chrome. **Use when:** adding a host-launched process to the dev environment.

## Checklist

1. **Verify host runtime prerequisites first** — compare host tool versions (`node --version`, etc.) against the tool engines ranges and LOG the result. A too-low host tool produces cryptic, often invisible failures (failure signature in mem:devcontainer-workflows/devtools-mcp-host-process).
2. **Standalone, logged init script** — put launch logic in a standalone script (e.g. `.devcontainer/init.sh`) with per-step timestamped logs to an agent-readable workspace path (`.tmp/` in the repo root → `/workspace/.tmp/` inside the container). Never a bare inline hook (silent failures) and never $HOME.
3. **POSIX-safe detach** — `( nohup cmd >> log 2>&1 & )` subshell. No `disown` (bash-only builtin → exit 127 under dash, FAILS the devcontainer start).
4. **Hermetic-test the hook shell** under BOTH dash and bash before relying on it (devcontainers/cli runs hooks via `/bin/sh -c`).
5. **CI-gate** — guard with the CI env check (CI=true in GitHub) and/or compose `profiles` + COMPOSE_PROFILES in the gitignored `.devcontainer/.env`.
6. **Verify end-to-end EARLY from inside the container** — probe the service URL (fast TCP probe) instead of only config-parsing: a config that parses can still be unreachable.

## Related

- Concrete case: mem:devcontainer-workflows/devtools-mcp-host-process.
- Hook timing/shell semantics: mem:devcontainer-workflows/lifecycle-hook-semantics.
- Dev-environment change rules: mem:devcontainer-workflows/change-management.