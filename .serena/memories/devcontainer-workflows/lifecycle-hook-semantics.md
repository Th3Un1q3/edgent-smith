# Dev-Container Lifecycle Hook Semantics

When each devcontainer lifecycle hook runs, which shell executes it, failure behavior, and CI gating. **Use when:** debugging why a hook did or did not run, wiring services in devcontainer.json, or placing host-side setup.

## When hooks run

- `initializeCommand` runs ON THE HOST, only at container CREATE/REBUILD — a plain restart/attach re-runs nothing (empty log after a restart is expected, not proof of a problem).
- Creation order: `onCreateCommand` → `updateContentCommand` → `postCreateCommand`. Per start/attach: `postStartCommand` / `postAttachCommand`.
- One failing hook skips the remaining hooks.

## Shell and portability

- Hooks run via `/bin/sh -c` (devcontainers/cli) → dash on Ubuntu/GitHub runners → POSIX-only syntax.
- Bash-only builtins (e.g. `disown`) exit 127 and FAIL the devcontainer start. Test any hook shell under BOTH dash and bash.

## CI gating patterns

- Guard inside hooks with the CI env check (`CI != true` — GitHub sets CI=true) so local-only setup never runs in CI.
- Compose sidecars: service `profiles` set to infra + `COMPOSE_PROFILES=infra` in the gitignored `.devcontainer/.env` (local init appends it; ci.yml truncates it).

## Agent-readable logging

- Hooks run on the HOST — log to the workspace (`.tmp/` in the repo root → `/workspace/.tmp/` inside the container), never $HOME, so agents can debug from inside the container.

## Related

- Concrete host-launch case: mem:devcontainer-workflows/devtools-mcp-host-process.
- Change rules for dev-environment edits: mem:devcontainer-workflows/change-management.
- General launcher checklist: mem:devcontainer-workflows/host-side-service-launchers.