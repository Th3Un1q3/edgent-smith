# dsh harness config source (.dsh → ~/.dsh)

This directory is the **source** for the container's dsh home and, via a single
bind mount, the live home (see `.devcontainer/docker-compose.yml`):

```yaml
      - ../.dsh:/home/vscode/.dsh
      - opencode_data:/home/vscode/.local/share/opencode
```

The repo directory `../.dsh` is bind-mounted to `~/.dsh` (from this file's
location `../.dsh` resolves to the repo root). Tracked config
(`cordis.patch.yml`, `.agent-presets/`, `child-runtime/`) is live immediately;
machine state (`sessions/`, `storages/`, `.pnpm-store/`) persists in the repo
(gitignored) and survives rebuilds. `opencode_data` remains a named volume for
opencode. `setup-dev.sh` ensures `~/.dsh` exists and is owned by `vscode`
before seeding or installing.

> **PRIMARY authority** on preset location: DSH 0.1.1-rc.2 code — `USER_PRESET_DIR = dshHome/.agent-presets` (DOT) with `includeUserRoot:true` + `trust:user` (`lib/index.js:851`, `dsh-agent-presets` README "Append `<dshHome>/.agent-presets` as a user root"). `dsh --dump-config` shows only `default: standard` with no roots override, so only DOT is scanned. This README/docs are SECONDARY — if they diverge, upstream code wins.

## Path disposition

| Path | Content | Disposition |
|---|---|---|
| `cordis.patch.yml` | Home-level plugin patch for all profiles (holds the `mcp-gateway` entry in `insert:` form AND the `subagent-dsh-sdk` out-of-process worker provider) | via `../.dsh` bind, live, tracked |
| `README.md` | This file | via `../.dsh` bind |
| `.agent-presets/` | User presets (orchestrator, rug, worker, orch-worker) — **DSH `USER_PRESET_DIR` (DOT) scanned via `includeUserRoot:true` + `trust:user` (lib/index.js:851, dsh-agent-presets README)** — live preset root | via `../.dsh` bind, rw, live, **TRACKED** |
| `child-runtime/` | Version-controlled worker harness for the out-of-process subagent provider (Option B): `package.json` + `pnpm-lock.yaml` pin the child's plugin stack, `cordis.yml` is the child's OWN composition (bash, fs, ask-user, todo, MCP gateway client). `node_modules/` is gitignored and installed by `setup-dev.sh` | via `../.dsh` bind; `setup-dev.sh` also materializes and runs `pnpm install` when `node_modules` missing |
| `settings.yaml` | Provider/model settings | via `../.dsh` bind; seeded by `setup-dev.sh` only if absent (idempotent) |
| `.env` | `LOCAL_GATEWAY_API_KEY=local` (dummy) | via `../.dsh` bind; seeded if absent, gitignored |
| `.credentials.yaml` | Real `OPENCODE_GO_API_KEY` | via `../.dsh` bind; seeded if absent, gitignored, never auto-generated |
| `sessions/`, `storages/` | Harness runtime state | via `../.dsh` bind — persists in repo (gitignored), survives recreate |
| `profiles/` | Per-profile dirs incl. `node_modules` | via `../.dsh` bind — also generated from bundle if missing |
| `.pnpm-store/` | pnpm cache | via `../.dsh` bind (gitignored) |
| `agent-presets/` | **LEGACY — moved to `.agent-presets/` (DOT USER_PRESET_DIR)** — kept as empty dir with `.gitkeep` for backward compat; NOT scanned by harness | via `../.dsh` bind (empty, tracked placeholder) |

Ignore rules for this directory live in the root `.gitignore` (section "dsh
harness home").

## Why three files are seeded instead of bind-mounted (legacy note)

With the current single directory bind (`../.dsh:/home/vscode/.dsh`) a file
rename inside `~/.dsh` succeeds (same filesystem) and a fresh clone keeps files
as files. Seeding remains idempotent: `setup-dev.sh` copies `settings.yaml`,
`.env`, `.credentials.yaml` from `/workspace/.dsh` to `~/.dsh` only when absent,
so the repo provides the initial config and later edits survive a recreate.
Historically a `dsh_persistent` named volume with per-file `:ro` binds caused
`EBUSY` on rename and Docker creating a directory when a gitignored source was
missing; the seed logic handled that case.

## Lifecycle

- **`docker compose down -v`** deletes named volumes (`opencode_data`,
  `ollama_data`, `mcp_images`) but **not** `../.dsh` — it is a host bind, so
  its contents persist. Factory reset: `rm -rf .dsh/sessions .dsh/storages` or
  delete a single file from `.dsh/`.
- **`docker compose down`** keeps the bind contents and named volumes.
- **A plain restart** keeps everything.
- `profiles/` cold-regenerates from dsh's bundle with no network and no
  `pnpm install` if removed.

## Out-of-process worker subagents (Option B)

The `orch-worker` preset's `worker` tool is `dsh-tool-subagent` bound to the
`dsh-sdk` provider: each worker runs as a COMPLETE separate Harness process
with its own tools and composition, instead of an in-process child that joins
the parent's preset. Why: an in-process child can only inherit or narrow the
parent's composition and this deployment's global tool layer (host tools +
MCP gateway) cannot be stripped per-agent from a preset (the build's
`tools.restrict`/`toolFilter` is non-functional; the sandbox withholds
`restrict`).

Reproduction is fully version-controlled:

- `cordis.patch.yml` inserts the host-side `subagent-dsh-sdk` provider row
  (a provider name may only be registered once per process, so it lives here,
  never in a preset). It spawns `node --expose-internals <child bin>
  <child cordis.yml>` with `DSH_HOME=~/.dsh/child-home`.
- `child-runtime/` holds the child's own harness composition (`cordis.yml`:
  base spine + `dsh-sdk-jsonrpc-server` + `dsh-mcp-client` with the same
  central gateway config) and its dependency manifest (`package.json` +
  `pnpm-lock.yaml`, installed into `~/.dsh/child-runtime` by `setup-dev.sh`).
- `setup-dev.sh` (`.devcontainer/`) installs the four `dsh-sdk-*` packages
  into the web profile and materializes the child runtime.

After a container (re)build the host must be restarted once (or the web
profile booted) so the provider registers; then a session on `orch-worker`
gets a working `worker` tool. The child rejects parent-enforced
`toolFilter`/`persona`/`outputSchema` by design — its own composition decides.

## Authoring presets

- Presets are directories under `.agent-presets/<id>/` (DOT, `USER_PRESET_DIR` per upstream `lib/index.js:851` + `dsh-agent-presets` README) holding an `agent.cordis.yml` (+ optional `preset.yml`). Copy an existing one (e.g. `standard` with the GUI's create flow) or author directly. **Do NOT use `agent-presets/` (NO dot) — it is legacy and NOT scanned.**
- The mount is rw, so the GUI preset-create flow writes straight into `~/.dsh/.agent-presets/` which is the repo's `.dsh/.agent-presets/` via bind.
- Roster discovery is unmemoized and re-reads the filesystem per call, so editing a preset here is live for the next session — no restart. Discovery scans ONLY DOT (`~/.dsh/.agent-presets/`) when `dump-config` shows no roots override.
- Deleting a preset = delete its directory under `.agent-presets/`. The roster's `remove()` realpath check may refuse (it requires the literal home root path), so the directory in this repo is the authoritative delete.
- `.agent-presets/` holds tracked presets (`orchestrator/`, `rug/`, `worker/`, `orch-worker` — each with `agent.cordis.yml` + `preset.yml`) referenced by `settings.yaml:agent-presets.default: orch-worker`. `agent-presets/` (NO dot) is legacy empty dir kept with `.gitkeep` for backward compat.
