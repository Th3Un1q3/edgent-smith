# dsh harness home (.dsh → ~/.dsh)

This directory IS the DeepSeek Harness home. The devcontainer bind-mounts it to
`~/.dsh` (see `.devcontainer/docker-compose.yml`):

```yaml
- ../.dsh:/home/vscode/.dsh
```

Because the home is a **workdir directory**, it persists with the repository —
no named volume to wipe, and no copy/restore steps (`~/.dsh` writes go straight
into this directory).

## What is tracked vs ignored

| Path | Content | Tracked |
|---|---|---|
| `settings.yaml` | Provider/model settings | yes (config-as-code) |
| `cordis.patch.yml` | Home-level plugin patch (all profiles) | yes |
| `agent-presets/` | User-authored agent presets (e.g. `rug/` = RUG Mode) | yes |
| `README.md` | This file | yes |
| `profiles/` | Per-profile dirs incl. `node_modules` (created by dsh on first boot) | ignored |
| `sessions/`, `storages/`, `.pnpm-store/` | Harness runtime state | ignored |
| `.env`, `.credentials.yaml` | Local credentials (dummy gateway key etc.) | ignored (keep locally) |

Ignore rules live in the root `.gitignore` (section "dsh harness home").

## Authoring presets

- Presets are directories under `agent-presets/<id>/` holding an
  `agent.cordis.yml` (+ optional `preset.yml`). Copy an existing one (e.g.
  `standard` with the GUI's create flow) or author directly.
- Roster discovery is unmemoized and re-reads the filesystem per call, so
  editing a preset here is live for the next session — no restart.
- Deleting a preset = delete its directory here. The roster's `remove()`
  realpath check may refuse (it requires the literal home root path), so the
  directory in this repo is the authoritative delete.

## Lifecycle notes

- **Fresh clone**: the tracked config is already the home — first `dsh` boot
  generates `profiles/`, `sessions/`, etc. into this directory.
- **Existing container without the mount**: migrate once with
  `rsync -a --exclude='.agent-presets' ~/.dsh/ /workspace/.dsh/`, then rebuild
  the devcontainer so the compose bind mount takes effect.
- **`dsh_data` named volume is gone** from docker-compose; an orphan volume of
  that name can be removed with `docker volume rm dsh_data`.