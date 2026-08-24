# Workflow: Install a CLI Tool

Install a CLI tool into the devcontainer so it survives rebuilds, resolves on every shell, and verifiably works. The repo's CLI installs (rtk, conductor, @github/copilot, dsh) follow this path.

**Tools:** bash, npm (for npm-distributed CLIs), the devcontainer lifecycle hook `postCreateCommand` in devcontainer.json. **Prerequisites:** write access to the repo, a running devcontainer, and the target's published versions visible via `npm view <pkg> versions`.

**Order of operations:** pin → guard → install → PATH → volume → config → verify → document.

## Step 1 — Pin the exact version, rc tags included

Resolve the target version from the registry, not from memory. `npm view <pkg> version` returns the latest stable; `npm view <pkg> dist-tags` shows tags such as `rc`. A moving dist-tag (`latest`, `rc`) drifts on reinstall; a pinned string plus a version-checked guard stays reproducible.

```bash
npm view @deepseek-ai/dsh dist-tags
npm install -g @deepseek-ai/dsh@0.1.1-rc.2
```

Done when: the pinned string appears in the install command.

## Step 2 — Guard the install with a version check, not a presence check

Place the install behind an idempotent, version-checked guard. A bare `command -v X` guard passes forever once the binary exists and silently never reinstalls — the repo's @github/copilot install shipped this bug. Compare the installed version against the pinned string instead.

```bash
if ! command -v dsh || [[ "$(dsh --version 2>/dev/null)" != "0.1.1-rc.2" ]]; then
  npm install -g --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs @deepseek-ai/dsh@0.1.1-rc.2
fi
```

Done when: re-running the setup script reinstalls nothing while the pinned version is present.

## Step 3 — Whitelist postinstall scripts explicitly

npm 11 gates postinstall scripts by default and skips them silently (see [references/npm-and-native-modules.md](../references/npm-and-native-modules.md)). Pass `--allow-scripts=<comma-separated>` naming every gated script the tool needs — the package's own postinstall plus any native deps it pulls in. dsh needs `dsh-subprocess-local`, and its native deps `koffi`, `node-pty`, and `protobufjs` also break when gated.

```bash
npm install -g --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs @deepseek-ai/dsh@0.1.1-rc.2
```

Done when: the install completes and the tool's helper binaries exist (Step 7 verifies).

## Step 4 — Export PATH dynamically

npm's global bin lives under the nvm node layout; `containerEnv.PATH` may omit it, so non-interactive shells cannot find the tool. Export the path dynamically from npm rather than hardcoding the node-versioned path (quirk detail: [references/devcontainer-lifecycle-and-persistence.md](../references/devcontainer-lifecycle-and-persistence.md)).

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
```

Done when: a fresh non-interactive shell resolves the tool.

## Step 5 — Fix home-mounted volume ownership

A named volume freshly mounted into the dev user's home is root-owned (root:root 755), so the dev user hits EACCES — dsh failed even `--dump-config` until fixed. In postCreate, create the mount point and chown it to the dev user; mirror the opencode `/home/vscode/.local/` precedent.

```bash
# dev user must own the fresh volume mount
mkdir -p /home/vscode/.dsh
sudo chown -R $(id -u):$(id -g) /home/vscode/.dsh
```

Done when: the dev user writes into the mounted directory without sudo.

## Step 6 — Config as code

Preferred pattern: make the tool's home dir a **workdir mount** so config needs
no restore. dsh's `~/.dsh` is bind-mounted from the repo's `.dsh/` directory
(`.devcontainer/docker-compose.yml`: `- ../.dsh:/home/vscode/.dsh`) — tracked
config lives in `.dsh/`, machine state is gitignored, and nothing is copied.
Migrate an existing container once: `rsync -a --exclude='.agent-presets' ~/.dsh/ /workspace/.dsh/`, then rebuild.

Fallback pattern (home not mounted from the workdir): store templates under
`.devcontainer/<tool>/` and restore idempotently. Home-dir config (~/.dsh)
wipes on rebuild; the workspace mount persists, so the template is the source
of truth — dsh's are `settings.yaml` and `cordis.patch.yml`. `cp -u` copies
only when the source is newer, so a user edit with a newer mtime survives.
Guard the copy with `[[ -f ]]` so first-run absence does not error.

```bash
mkdir -p ~/.dsh
if [[ -f .devcontainer/dsh/settings.yaml ]]; then
  cp -u .devcontainer/dsh/settings.yaml ~/.dsh/settings.yaml
  cp -u .devcontainer/dsh/cordis.patch.yml ~/.dsh/cordis.patch.yml
fi
```

Done when: a rebuild restores the same config and a user's newer edits survive.

## Step 7 — Verify with introspection, native-load checks, and a bounded smoke

Verify from the installed artifact, then run one bounded smoke and classify the outcome. Classifications: PASS, PASS-WITH-CAVEAT (external cause — quota 403, upstream metadata), FAIL (config-side). No retry loops — one bounded attempt, then classify. Full catalog: [references/verification-and-hygiene.md](../references/verification-and-hygiene.md).

```bash
dsh --dump-config          # introspection: config parses, shape matches docs
node -e "require('koffi')" # native-load check for native deps
timeout 10 dsh --dump-config # bounded smoke, classified
```

Done when: each check returns and you can state one classification per check.

## Step 8 — Document the install

Record the pinned version, the guard, the allow-scripts whitelist, the PATH export, and the config restore in the repo's setup script comments or docs. Name env vars, never values.

Done when: a fresh clone plus rebuild reproduces the install from the docs alone.

## Acceptance criteria

- The install is pinned, guarded, idempotent, and verified — re-running setup changes nothing.
- The tool resolves in non-interactive shells; native loads succeed; the smoke is classified.
- Config restores from repo templates; no secret value appears in any file.

## Example application: dsh MCP runner

This repo installs `@deepseek-ai/dsh@0.1.1-rc.2` via postCreate. The same steps apply: pinned rc tag → version guard → `--allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs` → `export PATH="$(npm prefix -g)/bin:$PATH"` → chown `/home/vscode/.dsh` → home is a workdir bind mount (`.dsh/` → `~/.dsh`; no config restore needed) → `dsh --dump-config` plus a bounded smoke classified PASS or FAIL.
