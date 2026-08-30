# dsh harness config source (.dsh → ~/.dsh)

This directory is the **source** for the container's dsh home, not the live
home. The devcontainer mounts the `dsh_persistent` named volume at `~/.dsh` and
layers this directory on top of it (see
`.devcontainer/docker-compose.yml`):

```yaml
      - dsh_persistent:/home/vscode/.dsh
      - ../.dsh/cordis.patch.yml:/home/vscode/.dsh/cordis.patch.yml:ro
      - ../.dsh/README.md:/home/vscode/.dsh/README.md:ro
      - ../.dsh/agent-presets:/home/vscode/.dsh/agent-presets
      - /home/vscode/.dsh/profiles
      - /home/vscode/.dsh/.pnpm-store
      - /home/vscode/.dsh/.agent-presets
```

Three layers, most specific path wins: the named volume carries machine state,
the bind mounts deliver tracked config, and the anonymous volumes carry derived
caches that rebuild from scratch.

## Path disposition

| Path | Content | Disposition |
|---|---|---|
| `cordis.patch.yml` | Home-level plugin patch for all profiles (holds the `mcp-gateway` entry in `insert:` form AND the `subagent-dsh-sdk` out-of-process worker provider) | bind-mounted `:ro`, hot-reloaded |
| `README.md` | This file | bind-mounted `:ro` |
| `agent-presets/` | User-authored agent presets (e.g. `rug/` = RUG Mode) | bind-mounted rw |
| `child-runtime/` | Version-controlled worker harness for the out-of-process subagent provider (Option B): `package.json` + `pnpm-lock.yaml` pin the child's plugin stack, `cordis.yml` is the child's OWN composition (bash, fs, ask-user, todo, MCP gateway client). `node_modules/` is gitignored and installed by `setup-dev.sh` | source only (materialized into `~/.dsh/child-runtime` by setup-dev.sh) |
| `settings.yaml` | Provider/model settings | seeded into `dsh_persistent`, then owned by dsh |
| `.env` | `LOCAL_GATEWAY_API_KEY=local` (dummy) | seeded into `dsh_persistent`, gitignored |
| `.credentials.yaml` | Real `OPENCODE_GO_API_KEY` | seeded into `dsh_persistent`, gitignored, never committed and never auto-generated |
| `sessions/`, `storages/` | Harness runtime state | `dsh_persistent` — survives a recreate |
| `profiles/` | Per-profile dirs incl. `node_modules` | anonymous volume — dropped on recreate |
| `.pnpm-store/` | pnpm cache | anonymous volume — dropped on recreate |
| `.agent-presets/` | dsh-generated preset cache | anonymous volume — dropped on recreate |

Ignore rules for this directory live in the root `.gitignore` (section "dsh
harness home").

## Why three files are seeded instead of bind-mounted

- **`settings.yaml`** — dsh rewrites it atomically: write a temp file, then
  `rename()` it over the target. Renaming onto a mount point fails with
  `EBUSY`. A file bind also pins the inode at mount time, so later repo edits
  would never reach the container.
- **`.env` and `.credentials.yaml`** — both gitignored, so a fresh clone has no
  source file. Docker then silently creates a **directory** at the mount path
  instead of failing, and dsh reads neither.

`.devcontainer/setup-dev.sh` does the seeding: it copies each file from this
directory into `~/.dsh` only when that file is absent. The copy is idempotent —
a second run is a no-op, so the repo stays the canonical initial config while
every change dsh or its UI makes afterwards survives a recreate.

## Lifecycle

- **`docker compose down -v`** deletes `dsh_persistent` with the other named
  volumes; the next boot re-seeds from this repo. That is the factory reset.
  To reset a single file instead, delete it from the volume.
- **`docker compose down`** keeps `dsh_persistent` and drops the three
  anonymous volumes.
- **A plain restart** keeps everything, anonymous volumes included.
- The caches are anonymous volumes rather than tmpfs: tmpfs is RAM-backed and
  wipes on every stop. `profiles/` cold-regenerates from dsh's own bundle with
  no network and no `pnpm install`.

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

- Presets are directories under `agent-presets/<id>/` holding an
  `agent.cordis.yml` (+ optional `preset.yml`). Copy an existing one (e.g.
  `standard` with the GUI's create flow) or author directly.
- The mount is rw, so the GUI preset-create flow writes straight into the repo.
- Roster discovery is unmemoized and re-reads the filesystem per call, so
  editing a preset here is live for the next session — no restart.
- Deleting a preset = delete its directory here. The roster's `remove()`
  realpath check may refuse (it requires the literal home root path), so the
  directory in this repo is the authoritative delete.
- ⚠️ `agent-presets/` is currently **empty**: its only contents
  (`rug/agent.cordis.yml`, `rug/preset.yml`) are deleted but not yet committed,
  and git cannot track empty directories. On a fresh clone the directory will
  not exist, and the bind mount has no source. Commit a real preset or a
  tracked placeholder file to restore it.
