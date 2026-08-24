# Reference: Devcontainer Lifecycle and Persistence

Know when an install hook runs, what survives a rebuild, and where the dev user can write. Use this reference when placing an install or debugging why a tool vanished after `up` or a rebuild.

## Vocabulary

- **Feature** — a packaged, versioned devcontainer install unit (OCI image layer) declared under `features` in devcontainer.json.
- **lifecycle hook** — an install/start script declared in devcontainer.json (`onCreateCommand`, `updateContentCommand`, `postCreateCommand`, `postStartCommand`, `postAttachCommand`).
- **named volume** — a Docker volume mounted by name; persists across container rebuilds.
- **rebuild** — recreating the container (devcontainer rebuild), distinct from plain `up`.

## Lifecycle semantics

- `onCreateCommand` → `updateContentCommand` → `postCreateCommand` run only on create or rebuild, in that order; a failing script skips the later ones.
- `postStartCommand` and `postAttachCommand` run on every container start.
- Plain `up` of an existing container does NOT re-run postCreate — installs in postCreate persist only if they survive the rebuild wipe (below).

## Placement options

| Option | When to choose |
|---|---|
| devcontainer Feature (build-time, cached, pinnable, lockable) | Registry-at-rebuild is unacceptable, or version churn stabilizes into a stable pin. Repo precedent: opencode 1.18.18 as a Feature. |
| postCreateCommand runtime script | npm/curl CLI tools. Installs against the actual node (kills ABI drift); costs rebuild time plus registry access. Repo precedent: rtk, conductor, @github/copilot, dsh. |
| Dockerfile bake | The tool must exist to build the image itself, or install must not touch the runtime container. |

Choose postCreateCommand for npm/curl CLI tools; promote to a Feature when registry access at rebuild is unacceptable or the version churns to a stable pin.

## Rebuild wipes

A rebuild wipes the npm global prefix, home-dir state (`~/.dsh`, `~/.npmrc`), and any non-volume path under the dev user's home. Only the workspace mount and named volumes survive.

## Fresh-volume root-ownership trap

A fresh named volume mounts root-owned (root:root 755), so the dev user hits EACCES on write — dsh failed even `--dump-config` until fixed. Fix in postCreate with mkdir plus chown; mirror the opencode `/home/vscode/.local/` precedent:

```bash
mkdir -p /home/vscode/.dsh
sudo chown -R $(id -u):$(id -g) /home/vscode/.dsh
```

Any named volume mounted into the dev-user home needs this step.

## PATH / containerEnv quirks

`containerEnv.PATH` can bake host paths via `${localEnv:PATH}` and omit the npm global bin, so non-interactive shells cannot find installed tools. Export the path dynamically instead of hardcoding the node-versioned path:

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
```

## forwardPorts

Host access to a tool's web UI requires `forwardPorts` plus a `portsAttributes` label; dsh's 3080 UI was unreachable until both were added.

```json
{"forwardPorts": [3080], "portsAttributes": {"3080": {"label": "dsh"}}}
```
