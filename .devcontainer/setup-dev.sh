#!/usr/bin/env bash
set -euo pipefail

FAST_MODE=false; if [[ "${1:-}" == "--fast" ]]; then FAST_MODE=true; fi

echo "Starting development environment setup..."

# Enable persistence volume for opencode
mkdir -p /home/vscode/.local/
sudo chown -R $(id -u):$(id -g) /home/vscode/.local/

# Ensure opencode bin directory is in PATH for this script
export PATH="/home/vscode/.opencode/bin:$PATH"
# The aidlc installer writes to ~/.local/bin. Exporting it before the guard
# below lets a re-run detect a binary an earlier run installed.
export PATH="/home/vscode/.local/bin:$PATH"

# Install codegraph cli(required for MCP)

# curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
# codegraph install --target=auto --location=local --yes


if [[ "$FAST_MODE" == false ]]; then
  echo "Running uv sync..."
  uv sync --dev --all-extras || echo "WARNING: uv sync failed (hardlink warning on overlayfs is expected)"

  if ! uv tool list | grep -q "huggingface_hub"; then
    echo "Installing huggingface_hub..."
    uv tool install --force huggingface_hub || echo "WARNING: huggingface_hub install failed"
  fi

  if ! command -v conductor &> /dev/null; then
    echo "Installing conductor..."
    CONDUCTOR_INSTALL_FORCE=1 curl -sSfL https://aka.ms/conductor/install.sh | sh -s -- --source "git+https://github.com/microsoft/conductor.git@v0.1.18" || echo "WARNING: conductor install failed"
  fi

  # aidlc workflows (https://github.com/awslabs/aidlc-workflows). The version is
  # pinned so a rebuild lands on the release this repo was projected with;
  # export AIDLC_VERSION to move it deliberately.
  AIDLC_INSTALL_URL="https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh"
  AIDLC_VERSION="${AIDLC_VERSION:-2.11.3}"
  if ! command -v aidlc &> /dev/null; then
    echo "Installing aidlc v${AIDLC_VERSION}..."
    curl -sSfL "$AIDLC_INSTALL_URL" | sh -s -- --version "$AIDLC_VERSION" || echo "WARNING: aidlc install failed"
  fi

  # aidlc projects its agents, skills, hooks and commands into the checkout, so
  # the projection has to run from the repository root rather than the caller's
  # cwd, and it has to run on every setup: a fresh clone has no projection and a
  # rebuilt container has a new home directory. --yes plus stdin from /dev/null
  # keeps it non-interactive; a failure warns, because a stale projection should
  # not block language and harness setup.
  AIDLC_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if command -v aidlc &> /dev/null; then
    if ( cd "$AIDLC_ROOT" && timeout 300 aidlc config --harness opencode --yes </dev/null ); then
      echo "aidlc projection refreshed"
    else
      echo "WARNING: aidlc projection failed; harness wiring may be stale"
    fi
    # doctor is advisory only: it also flags uncommitted aidlc/ state, which is
    # normal for a working container, so report the status and keep going.
    if ( cd "$AIDLC_ROOT" && timeout 120 aidlc doctor --no-color ); then
      echo "aidlc doctor: exit 0"
    else
      echo "WARNING: aidlc doctor exited non-zero (advisory; setup continues)"
    fi
  else
    echo "WARNING: aidlc unavailable; skipping projection and doctor"
  fi

  # Quality-gate sensors are a plugin sourced from the checkout: the projection
  # above neither builds its dist/ nor re-enables it, so a rebuilt container or a
  # fresh clone would silently lose them. Every step warns instead of aborting —
  # the sensors enhance the harness, they do not boot it.
  QUALITY_GATES_ROOT="$AIDLC_ROOT/aidlc-plugins/quality-gates"
  if [[ -d "$QUALITY_GATES_ROOT" && -f "$AIDLC_ROOT/.aidlc/tools/aidlc-plugin-build.ts" ]]; then
    if ( cd "$AIDLC_ROOT" && timeout 180 bun .aidlc/tools/aidlc-plugin-build.ts aidlc-plugins/quality-gates opencode </dev/null ); then
      if ( cd "$AIDLC_ROOT" && timeout 120 aidlc engine plugin sync --plugin-root "$QUALITY_GATES_ROOT/dist/opencode" --yes </dev/null ); then
        if ( cd "$AIDLC_ROOT" && timeout 120 aidlc engine plugin select aidlc quality-gates </dev/null ); then
          echo "quality-gate sensors enabled"
        else
          echo "WARNING: aidlc plugin select failed; quality-gate sensors not enabled"
        fi
      else
        echo "WARNING: aidlc plugin sync failed; quality-gate sensors not enabled"
      fi
    else
      echo "WARNING: quality-gate plugin build failed; quality-gate sensors not enabled"
    fi
  else
    echo "WARNING: quality-gate plugin sources or build script missing; sensors not enabled"
  fi
fi

# Install dsh (DeepSeek Harness CLI) - pinned rc, allow-scripts whitelist for native deps (node-pty, koffi, dsh-subprocess-local)
export PATH="$(npm prefix -g)/bin:$PATH"

# Install opencode via the official v2 installer (https://opencode.ai/v2/install).
# VERSION is intentionally left unset: the installer resolves the latest release
# when it is empty, so this always installs the newest version. The installer
# is non-interactive (no prompts, no TTY, no rc-file edits) and places the
# binary in $HOME/.opencode/bin, which devcontainer.json already puts on PATH.
# The guard is missing-only: re-running the script must not re-invoke the
# installer.
export HOME="${HOME:-/home/vscode}"
if command -v opencode &> /dev/null || [[ -x "$HOME/.opencode/bin/opencode" ]]; then
  echo "opencode already present, skipping install"
else
  if command -v curl &> /dev/null && command -v tar &> /dev/null && command -v bash &> /dev/null; then
    if curl -fsSL --retry 3 --retry-delay 2 --connect-timeout 15 https://opencode.ai/v2/install | bash; then
      # The installer does not modify PATH. If opencode is still not
      # resolvable, link the installed binary into the PATH directory
      # devcontainer.json sets.
      if ! command -v opencode &> /dev/null && [[ -x "$HOME/.opencode/bin/opencode" ]]; then
        mkdir -p /home/vscode/.opencode/bin
        if [[ ! -e /home/vscode/.opencode/bin/opencode ]]; then
          ln -sf "$HOME/.opencode/bin/opencode" /home/vscode/.opencode/bin/opencode
        fi
      fi
      if command -v opencode &> /dev/null; then
        echo "opencode $(opencode --version 2>/dev/null | head -n1)"
      else
        echo "ERROR: opencode not found after install" >&2
      fi
    else
      echo "WARNING: opencode install failed"
    fi
  else
    echo "WARNING: curl, tar, or bash missing; skipping opencode install"
  fi
fi
# ~/.dsh is the dsh_persistent named volume, with cordis.patch.yml, README.md
# and agent-presets/ bind-mounted on top from the repo (see docker-compose.yml).
# A fresh volume is root-owned, so dsh could not create sessions/ or storages/
# or write settings.yaml until we take ownership. cordis.patch.yml and README.md
# are mounted :ro and chown fails on them with EROFS even as root, so chown the
# home plus the directories beneath it (where dsh writes state) instead of the
# whole tree, and never let a read-only mount abort setup. The config files that
# cannot be bind-mounted are seeded below.
mkdir -p /home/vscode/.dsh
sudo chown "$(id -u):$(id -g)" /home/vscode/.dsh
sudo find /home/vscode/.dsh -mindepth 1 -maxdepth 1 -type d -exec chown -R "$(id -u):$(id -g)" {} + \
  || echo "WARNING: could not chown every ~/.dsh subdirectory (read-only mounts are expected)"
if [[ "$FAST_MODE" == false ]]; then
  DSH_VERSION="0.1.1-rc.2"
  if ! command -v dsh &> /dev/null || [[ "$(dsh --version 2>/dev/null)" != "$DSH_VERSION" ]]; then
    echo "Installing dsh v${DSH_VERSION}..."
    npm install -g --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs "@deepseek-ai/dsh@${DSH_VERSION}" || echo "WARNING: dsh install failed"
  else
    echo "dsh v${DSH_VERSION} already installed"
  fi
fi

# Seed the three files the volume starts empty of. They are not bind-mountable:
# settings.yaml is rewritten live by the dsh UI (a mounted inode would pin the
# repo copy), and .env / .credentials.yaml are gitignored, so a file bind would
# silently become a directory on a fresh clone. Copy only when missing, so the
# repo provides the initial config and everything dsh changes afterwards
# survives a recreate. Idempotent: a second run is a no-op.
DSH_HOME="/home/vscode/.dsh"
DSH_SEED_DIR="/workspace/.dsh"

if [[ ! -e "$DSH_HOME/settings.yaml" ]]; then
  if [[ -f "$DSH_SEED_DIR/settings.yaml" ]]; then
    echo "Seeding ~/.dsh/settings.yaml from the repo..."
    cp "$DSH_SEED_DIR/settings.yaml" "$DSH_HOME/settings.yaml"
    chmod 600 "$DSH_HOME/settings.yaml"
  else
    echo "WARNING: $DSH_SEED_DIR/settings.yaml not found; dsh will start with its own defaults"
  fi
fi

if [[ ! -e "$DSH_HOME/.env" ]]; then
  if [[ -f "$DSH_SEED_DIR/.env" ]]; then
    echo "Seeding ~/.dsh/.env from the repo..."
    cp "$DSH_SEED_DIR/.env" "$DSH_HOME/.env"
  else
    echo "WARNING: $DSH_SEED_DIR/.env not found; LOCAL_GATEWAY_API_KEY will be unset"
  fi
fi

# .credentials.yaml holds a real OPENCODE_GO_API_KEY: copy it, never print it,
# and never fabricate a placeholder for it.
if [[ ! -e "$DSH_HOME/.credentials.yaml" ]]; then
  if [[ -f "$DSH_SEED_DIR/.credentials.yaml" ]]; then
    echo "Seeding ~/.dsh/.credentials.yaml from the repo (contents not shown)..."
    cp "$DSH_SEED_DIR/.credentials.yaml" "$DSH_HOME/.credentials.yaml"
    chmod 600 "$DSH_HOME/.credentials.yaml"
  else
    echo "WARNING: $DSH_SEED_DIR/.credentials.yaml not found; the default opencode-go provider will have no API key"
  fi
fi

# ── Out-of-process worker subagent runtime (Option B) ─────────────────────────
# The `orch-worker` preset delegates to a WORKER that runs as a complete
# separate Harness process via the `dsh-sdk` subagent provider. Everything is
# reproducible: the child harness composition and its dependency manifest are
# version-controlled (`.dsh/child-runtime/`), and this block materializes them
# into the persistent home and installs the pinned deps when missing.

# 1) The web profile gets the provider packages (a bare profile regenerates
#    from dsh's bundle on recreate, so this re-runs and re-adds them).
if command -v dsh &> /dev/null; then
  dsh plugin --profile web add \
    "@deepseek-ai/dsh-sdk-protocol@0.1.1-rc.2" \
    "@deepseek-ai/dsh-subagent-dsh-sdk@0.1.1-rc.2" \
    "@deepseek-ai/dsh-sdk-client@0.1.1-rc.2" \
    "@deepseek-ai/dsh-sdk-jsonrpc-demo@0.1.1-rc.2" \
    "@deepseek-ai/dsh-sdk-jsonrpc-server@0.1.1-rc.2"
  if ! dsh plugin --profile web list | grep -q "dsh-subagent-dsh-sdk"; then
    echo "ERROR: dsh-sdk subagent provider not found in web profile after add" >&2
    exit 1
  fi
else
  echo "ERROR: dsh not found — cannot add subagent provider" >&2
  exit 1
fi

# 2) The child harness runtime (own tools: bash, fs, ask-user, todo, MCP
#    gateway client) is materialized from the repo into the persistent home and
#    its pinned dependencies installed unconditionally (CI=true avoids prompts).
if [[ -f "$DSH_SEED_DIR/child-runtime/package.json" ]]; then
  mkdir -p "$DSH_HOME/child-runtime"
  safe_cp() {
    local src="$1" dst="$2"
    if [[ ! -e "$src" ]]; then return 0; fi
    if [[ -e "$src" && -e "$dst" ]] && test "$src" -ef "$dst"; then return 0; fi
    if [[ -f "$src" && -f "$dst" ]] && cmp -s "$src" "$dst"; then return 0; fi
    mkdir -p "$(dirname "$dst")"
    cp -u --preserve=mode "$src" "$dst"
  }
  safe_cp "$DSH_SEED_DIR/child-runtime/package.json" "$DSH_HOME/child-runtime/package.json"
  safe_cp "$DSH_SEED_DIR/child-runtime/pnpm-workspace.yaml" "$DSH_HOME/child-runtime/pnpm-workspace.yaml"
  safe_cp "$DSH_SEED_DIR/child-runtime/cordis.yml" "$DSH_HOME/child-runtime/cordis.yml"
  safe_cp "$DSH_SEED_DIR/child-runtime/pnpm-lock.yaml" "$DSH_HOME/child-runtime/pnpm-lock.yaml"
  command -v pnpm &> /dev/null || npm install -g pnpm@10
  echo "Installing child harness runtime dependencies (Option B worker)..."
  CI=true pnpm --dir "$DSH_HOME/child-runtime" install --frozen-lockfile
  # 3) Isolated dsh home for child processes so their sessions never collide
  #    with the parent's (the provider passes DSH_HOME=~/.dsh/child-home).
  mkdir -p "$DSH_HOME/child-home"
fi
# NOTE: after a fresh container, restart the dsh host once (or boot the web
# profile) so the `dsh-sdk` provider row in cordis.patch.yml registers; then a
# session on the `orch-worker` preset gets a working `worker` tool.

echo "Setup complete!"
