# Untrusted Code Sandbox

A single-container Dev Container for running untrusted code. It applies to any repository and builds nothing from source.

- **Image**: `mcr.microsoft.com/devcontainers/base:noble`, a ready-made multi-arch Microsoft image. There is no Dockerfile and no `build` section.
- **Features**: `git:1`, `node:2` (`lts`), `python:1`, `github-cli:1`, `just:0`, `uv:1`, `opencode:1`, requested from proven sources with major-version tags.
- **User**: the non-root `vscode` user (UID/GID 1000). `updateRemoteUserUID: false` leaves the baked IDs alone.
- **Volumes**: named volumes `untrusted-code-sandbox-opencode-data` at `/home/vscode/.local/share/opencode`, `untrusted-code-sandbox-opencode-state` at `/home/vscode/.local/state/opencode`, and `untrusted-code-sandbox-tmp` at `/tmp`.
- **Post-create**: `.devcontainer/post-create.sh` runs on first create.

Do not pin `python` to a version. Pinning makes the Feature compile CPython from source and fails on arm64. The earlier custom build failed on Apple Silicon for that and three other reasons; this template removes the build.

`post-create.sh` runs as `vscode`. Docker creates named volumes root-owned, so the script uses the image's passwordless sudo to recursively chown `~/.local` (both opencode volumes) to the running user's UID:GID, give `/tmp` to that user with mode `1777`, and add the workspace to git's `safe.directory` so the read-write bind mount is not refused for dubious ownership. Every step is idempotent and non-fatal.

## Security

Hardening is limited to the non-root user plus `devcontainer.json`.

- Passwordless sudo stays because `post-create.sh` needs it. The container is root-equivalent; check with `sudo -n true`.
- No host Docker socket, SSH agent socket, GPG socket, credential mount, or host environment passthrough is configured.
- No `runArgs`, so no capability is dropped and `no-new-privileges` is not set.
- The workspace bind mount is read-write. Untrusted code can write git hooks, `.git/config` keys (`core.hooksPath`, `core.fsmonitor`), or `.vscode/tasks.json` that the host later runs, and can fill host disk.
- Network egress is unrestricted: host gateway, LAN, internet, and cloud metadata at `169.254.169.254`.
- The image tag and Feature tags are not digest-pinned.

The runtime injects channels this file cannot remove. Under VS Code Dev Containers the host SSH agent is forwarded and the host `.gitconfig` plus a credential helper that proxies to host credentials are installed. Before a hostile run, set `dev.containers.copyGitConfig: false` and `dev.containers.gitCredentialHelperConfigLocation: "none"` in the host editor, and launch the editor with `SSH_AUTH_SOCK` unset. The Dev Container CLI does not forward these.

## Use

1. Apply the template, via the editor "Add Dev Container" flow or `devcontainer templates apply`.
2. Replace the image tag with a digest (`mcr.microsoft.com/devcontainers/base:noble@sha256:<digest>`) and digest-pin the Feature refs.
3. Create the container. Features install over the network; `post-create.sh` then fixes the volume permissions and marks the workspace safe for git.
4. Confirm the toolchain starts: `git`, `node`, `npm`, `python`, `gh`, `uv`, `just`, `opencode`.
5. Run the preflight checks. Each must hold: `ls /var/run/docker*` is empty; `ssh-add -l` fails; `git config --show-origin --get-all credential.helper` prints nothing and `~/.gitconfig` has no host credential helper; `env` shows no host secrets; and the result of `sudo -n true` is understood, because success means root-equivalent.
6. Run untrusted code only inside the container. Reset the workspace after a run, and do not open the untrusted tree with the host git or editor until you do.

For a real privilege boundary, add `runArgs` `--init`, `--cap-drop=ALL`, and `--security-opt=no-new-privileges:true`, and replace the `/tmp` volume with a tmpfs (`--tmpfs=/tmp:rw,noexec,nosuid,nodev,mode=1777,size=512m`); without capabilities the non-root user cannot chown a root-owned volume. Add `--network=none` when the workload needs no network, a volume-backed workspace to close the host-write channel, and resource ceilings (`--pids-limit`, `--memory`, `--cpus`). Change one flag at a time and recreate after each.
