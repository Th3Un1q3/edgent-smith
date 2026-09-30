# Dev container template security

This template runs untrusted code in a single, self-contained container. One file,
`templates/devcontainer.json`, defines everything: it starts from the first-party
Microsoft base image, installs every tool through a Feature, removes the host Docker
socket, declares no credential mount or host environment passthrough, runs as a
non-root user, drops Linux capabilities, and enables port auto-forwarding in
`notify` mode. There is no sibling Dockerfile.

The file cannot remove the host credentials the runtime injects into the container.
Under VS Code Dev Containers the host SSH agent is forwarded, the host `.gitconfig` is
copied in, and a git credential helper that proxies to host credentials is installed.
Read [Host credentials injected by the runtime](#host-credentials-injected-by-the-runtime)
and run the preflight checks before trusting hostile code.

## Threat model

- Attacker: code that runs as the non-root `vscode` user (UID 1000) after
  `postCreateCommand`, with no kernel or container-runtime zero-day.
- Assets: the host filesystem, the host Docker daemon and its workloads, host
  credentials (SSH keys, cloud tokens, `~/.git-credentials`, `~/.docker/config.json`),
  secrets in the workspace, the LAN, and cloud instance metadata.
- Trust boundary: the container-to-host line. The template crosses it through the
  workspace bind mount, the Docker network, and the three credential channels the
  runtime injects and this file cannot disable.
- Out of scope: container escape through a Docker or kernel CVE, a compromised base
  image or Feature build pipeline, and a malicious host.

## Privilege and sudo policy

The container runs as non-root `vscode`. `--cap-drop=ALL` removes every Linux
capability, and `--security-opt=no-new-privileges:true` sets the kernel
`no_new_privs` bit, so setuid/setgid binaries ignore their privilege bits. `sudo` is
setuid-root and therefore cannot elevate. `common-utils` is told `"sudoers": false`
so the dead passwordless entry is not installed at all.

Consequence: developers cannot `sudo apt-get install`. Install through Features,
`uv tool install`, `pip install --user`, `npm --prefix ~/.local`, and `~/.local/bin`.
A profile that needs real root is a separate template that also drops `--cap-drop=ALL`
and `no-new-privileges`; do not weaken this untrusted default.

## Tooling source

Every tool the template requests is present. Each comes from a Feature pinned to a
release.

| Tool | Source | Pin |
|---|---|---|
| common-utils, zsh | `ghcr.io/devcontainers/features/common-utils` (Microsoft) | `2.7.0`, `sudoers: false` |
| git | `ghcr.io/devcontainers/features/git` (Microsoft) | `1.3.8`, `version: os-provided` |
| gh CLI | `ghcr.io/devcontainers/features/github-cli` (Microsoft) | `1.1.3` |
| node | `ghcr.io/devcontainers/features/node` (Microsoft) | `2.1.0`, `version: 22` |
| python | `ghcr.io/devcontainers/features/python` (Microsoft) | `1.8.0`, `version: 3.13` |
| uv | `ghcr.io/devcontainers-extra/features/uv` | Feature `:1`, `version: 0.5.11` |
| opencode | `ghcr.io/devcontainers-extra/features/opencode` | Feature `:1`, `version: 1.18.32` |
| jq, unzip, xz-utils | `ghcr.io/devcontainers-extra/features/apt-packages` | Feature `:1`, `packages` |
| just | official `casey/just` release binary | `1.36.0`, SHA256SUMS check |

`devcontainers-extra` is a recognized publisher listed on `containers.dev/features`;
it replaces the previous Dockerfile for `uv` and `opencode`. `jq` has no trusted
dedicated Feature, so it installs as the distro package through the trusted
`apt-packages` Feature — the same Ubuntu-archive provenance as `apt-get install jq`.
`just` has no trusted Feature and is absent from the Ubuntu archive, so
`postCreateCommand` downloads the pinned official binary as the non-root user into
`~/.local/bin` and verifies it against the release `SHA256SUMS`. This is the only
install that needs network at create time.

## What the template mitigates

| Audit finding | Control |
|---|---|
| F1 host Docker socket | No Docker Feature and no socket mount. No daemon path is mounted. |
| F2 passwordless sudo | `sudoers: false`, `--cap-drop=ALL`, and `no-new-privileges` make sudo inert. Lifecycle commands never call sudo. |
| F3 host workspace tampering | Partly. The bind mount remains for source persistence; the residual below still applies. |
| F4 network reachability | Not by default. Add `--network=none` for a self-contained workload (stricter mode below). |
| F5 supply chain | Microsoft plus the recognized `devcontainers-extra` publisher; every Feature and tool pinned to a release, `just` checksum-verified. Image and Feature digests remain unpinned (residual). |
| F6 port forwarding and limits | Ports forward in `notify` mode, so a listener is surfaced, not silently published. `--pids-limit=2048`, `--memory=8g`, `--cpus=4` cap CPU, memory, and process abuse. Disk is not capped (residual). |
| F7 environment passthrough | No host `containerEnv`, `remoteEnv`, or `localEnv`. The only `containerEnv` appends the container's own `PATH`; it forwards no host variable. |
| F9 root user | `containerUser` and `remoteUser` are `vscode` explicitly. A bare `docker run` is still root (residual). |
| F10 lifecycle network use | `postCreateCommand` writes a git config value and installs `just`; no `sudo`, no `git-lfs`/`autoPull`. |

Extras kept: zsh, Oh My Zsh, and four passive editor extensions (EditorConfig,
GitLens, Prettier, Code Spell Checker).

## Host credentials injected by the runtime

The runtime injects these channels after the container starts. No devcontainer.json
property disables them, so the template cannot close them. Each item names the
mechanism, the user action, and a preflight check for the run checklist.

### SSH agent forwarding (High)

VS Code Dev Containers forwards the host SSH agent automatically and creates a socket
at `/tmp/vscode-ssh-auth-<uuid>.sock`. Forwarding happens even when `remoteEnv` sets
`SSH_AUTH_SOCK` to an empty string, and no supported setting turns it off. Untrusted
code reads `SSH_AUTH_SOCK`, authenticates as the host user to every server that trusts
the loaded keys, and signs commits as that identity. It cannot read the private key,
but it does not need to.

Action, pick one:

- Launch the editor from a shell with `SSH_AUTH_SOCK` unset.
- Run the workload without VS Code. The Dev Container CLI does not forward the agent.
- Run on a disposable host or VM that holds no agent.

Preflight: inside the container, `ssh-add -l` must fail with "Could not open a
connection to your authentication agent". A key list, or a populated `SSH_AUTH_SOCK`,
means the host agent is reachable.

### Git config copy and credential helper (High)

The VS Code extension copies the host `.gitconfig` into `/home/vscode/.gitconfig` on
startup and installs a credential helper that proxies to host credentials. Untrusted
code reads the file for tokens and `url.insteadOf` rewrites, and runs `git clone` or
`git push` against HTTPS remotes using the host's stored credentials. These are
host-side extension settings; `customizations.vscode.settings` configures the
in-container editor and cannot change them.

Required host settings before an untrusted run:

- `dev.containers.copyGitConfig: false`
- `dev.containers.gitCredentialHelperConfigLocation: "none"`

Preflight: `git config --show-origin --get-all credential.helper` must print nothing,
and `/home/vscode/.gitconfig` must be absent or carry no credential helper. The Dev
Container CLI does not install these.

### GPG forwarding (Medium, unverified)

The same startup path probes `/home/vscode/.gnupg/trustdb.gpg` and `gpg`, which
indicates GPG forwarding on some setups. When active, untrusted code signs or decrypts
with the host key. Confirm the behavior for your tool and version.

Preflight: `ls -la ~/.gnupg` and `gpg --list-secret-keys` must be empty. A non-empty
result means the host GPG key is reachable; run without forwarding or on a disposable
host when the workload does not need it.

## Residual risks

`devcontainer.json` cannot remove these. For hostile code, prefer the stricter modes
or a disposable host.

- Host bind mount as a host code-execution channel (F3). Untrusted code can write
  `.git/hooks/post-checkout`, `core.hooksPath` or `core.fsmonitor` in `.git/config`,
  or `.vscode/tasks.json` with `runOn: folderOpen`. The trusted host runs those when
  it next runs git or opens the folder. The mount cannot be escaped by `..` or
  symlink, so the blast radius is the workspace subtree plus host processes that
  interpret files in it.
- Network egress (F4). The default bridge reaches the host gateway, the LAN, the
  internet, and, on a cloud VM, the instance metadata service at `169.254.169.254`.
  `--network=none` is all-or-nothing; selective egress control and metadata-IP
  blocking need host network policy.
- Host disk exhaustion (F4, F6). `--memory`, `--cpus`, and `--pids-limit` bound CPU,
  memory, and process count only. Untrusted code fills host disk through the
  read-write workspace bind mount and the named volumes. Apply a host or volume quota,
  or watch free space during the run.
- Port auto-forwarding (F6). `notify` surfaces a listener to the human but still
  exposes it once confirmed, and an attacker-controlled service can be legitimate
  looking. Do not confirm a forwarded port you cannot account for.
- Build-time supply chain (F5). Every Feature `install.sh` and the `just`
  `postCreateCommand` execute code with network access. Pinned versions reduce the
  risk but do not remove it. Digest-pin the base image and Features before use.
- Kernel and runtime escape. A container-escape CVE defeats every in-file control.
  Use an updated runtime, and consider gVisor, Kata, or a VM for hostile code.
- Persisted scratch volumes (F11). Malware in `/tmp` or `/var/tmp` survives a
  rebuild. Remove the volumes between untrusted runs.
- Image-label merge. The base image ships a `devcontainer.metadata` label that can
  inject mounts, environment, and lifecycle commands not visible in this file.
- Root through a plain `docker run` (F9). `containerUser` and `remoteUser` are
  honored by spec-aware tools. A runner that ignores them, including a bare
  `docker run` of the image, starts as root. Do not run untrusted workloads on
  providers that ignore these keys.

## Running untrusted code

1. Copy `templates/devcontainer.json` into the target repository as
   `.devcontainer/devcontainer.json`. It is the only file the build needs.
2. Replace the `image` tag with a digest
   (`mcr.microsoft.com/devcontainers/base:ubuntu-24.04@sha256:<digest>`), and pin each
   Feature ref with `@sha256:<digest>`. Resolve digests with `docker manifest inspect`
   on the target architecture.
3. Set the host VS Code settings `dev.containers.copyGitConfig: false` and
   `dev.containers.gitCredentialHelperConfigLocation: "none"`, and launch the editor
   from a shell with `SSH_AUTH_SOCK` unset. Skip this step only when running without
   VS Code.
4. Build, which installs `jq`, `just`, `uv`, and `opencode`. The `just` step needs
   network, so let it finish before any offline untrusted phase.
5. Confirm the toolchain starts: `git`, `jq`, `gh`, `just`, `uv`, `node`, `python`,
   `opencode`, `zsh`.
6. Run the preflight checks before running code. Each must hold:
   - `sudo -n true` fails.
   - `ls /var/run/docker*` is empty, so no host Docker socket is present.
   - `ssh-add -l` fails, so the host SSH agent is not forwarded.
   - `git config --show-origin --get-all credential.helper` is empty and
     `~/.gitconfig` has no host credential helper.
   - `ls -la ~/.gnupg` is empty when the workload does not need GPG.
   - `env` shows no host secret variables.
7. Run the untrusted code inside the container, never on the host.
8. Recreate the scratch volumes between runs:
   `docker volume rm devcontainer-tmp-<id> devcontainer-vartmp-<id>`.
9. Reset the workspace after a run, and do not open the untrusted tree with the
   trusted host git or editor until you do.

## Optional stricter modes

Apply the ones the workload allows. Each has a cost.

- No network. Add `"--network=none"` to `runArgs`. Blocks installs, `git fetch`,
  `gh`, and any tool that phones home. Install everything the run needs at build time
  first. Best fit when the workload is self-contained. It does not hide the injected
  credential channels.
- Volume-backed workspace. Replace the active `workspaceMount` and `workspaceFolder`
  values with the commented pair in `devcontainer.json`:

  ```jsonc
  "workspaceMount": "source=devcontainer-ws-${devcontainerId},target=/workspaces/app,type=volume",
  "workspaceFolder": "/workspaces/app"
  ```

  This removes the host bind mount, so the host git and editor never see the files
  and the F3 channel and host disk write channel close. The volume starts empty:
  clone or copy the source in before the first run, and expect the project to be
  invisible on the host.
- Read-only root filesystem. Add `"--read-only"` and a `tmpfs` for `/run`. Requires
  the tools to write only to mounted paths; test the toolchain first.
- Stronger isolation. Run the container with gVisor or Kata, or on a disposable VM
  whose host holds no credentials. A disposable host or VM closes all three injected
  channels at once when the host cannot be reconfigured.
- Resource tuning. Keep the `--pids-limit`, `--memory`, and `--cpus` ceilings but
  raise them if a legitimate build fails. Lower them for a stricter cap. Add a host
  or volume disk quota, since these flags do not bound disk.

## Verification limits

- The base image and Feature tags are not digest-pinned here. Resolve and add digests
  before the first hostile run.
- The base image `devcontainer.metadata` label contents and the exact environment the
  target tool injects were not verified.
- `otherPortsAttributes` and `remote.autoForwardPorts` are documented; confirm both
  apply to the tool and version you use.
- Whether GPG forwarding is active by default for this template was not verified.
- The `/tmp` named volume does not hide the forwarded SSH socket because the tool
  layers a bind mount for the socket path on top of the volume. Confirm on the target
  tool and version.
- The `devcontainers-extra` `uv`, `opencode`, and `apt-packages` Features were not
  built in this environment. Confirm the toolchain with step 5 before running
  untrusted code.
