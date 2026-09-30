# Untrusted Code Sandbox

A single-container Dev Container for running untrusted code. It targets any
repository and installs a general toolchain: zsh with Oh My Zsh, git, the GitHub
CLI, Node 22, Python 3.13, `uv`, `opencode`, `jq`, `unzip`, `xz-utils`, and `just`.
There is no sibling Dockerfile and no lockfile; every tool comes from a
release-pinned Dev Container Feature except `just`, which `postCreateCommand`
downloads from the official release and checksum-verifies.

## Security posture

The container starts from the first-party Microsoft base image
`mcr.microsoft.com/devcontainers/base:ubuntu-24.04` as the non-root `vscode` user.
`runArgs` apply `--cap-drop=ALL`, `--security-opt=no-new-privileges:true`, and
`--init`, so setuid binaries and `sudo` cannot elevate. `common-utils` is installed
with `sudoers: false`, so no passwordless sudoers entry exists. No Docker socket,
SSH agent socket, GPG socket, credential mount, or host environment passthrough is
configured. Resource ceilings cap process count, memory, and CPU
(`--pids-limit=2048`, `--memory=8g`, `--cpus=4`). Ports auto-forward in `notify`
mode only. Source persists through a host bind mount; `/tmp` and `/var/tmp` use
per-instance named volumes.

The configuration cannot remove the channels the runtime injects after start. Under
VS Code Dev Containers the host SSH agent is forwarded, the host `.gitconfig` is
copied in, and a git credential helper proxies to host credentials. Disk use is not
bounded by the resource flags. Read `devcontainer.SECURITY.md` for the full threat
model, residual risks, preflight checks, and stricter modes such as
`--network=none` or a volume-backed workspace.

## Use

1. Apply the template to a repository (via the editor "Add Dev Container" flow or
   `devcontainer templates apply`).
2. Before running hostile code, replace the base image tag and each Feature ref with
   a digest (`@sha256:<digest>`).
3. On VS Code, set `dev.containers.copyGitConfig: false` and
   `dev.containers.gitCredentialHelperConfigLocation: "none"`, and launch the editor
   with `SSH_AUTH_SOCK` unset.
4. Build once with network so `postCreateCommand` can install `just`, then run the
   preflight checks in `devcontainer.SECURITY.md`.
5. Remove the `devcontainer-tmp-<id>` and `devcontainer-vartmp-<id>` volumes between
   untrusted runs.
