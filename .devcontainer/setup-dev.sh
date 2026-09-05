#!/usr/bin/env bash
set -euo pipefail

echo "Starting development environment setup..."

# Enable persistence volume for opencode
mkdir -p /home/vscode/.local/
sudo chown -R $(id -u):$(id -g) /home/vscode/.local/

# Ensure opencode bin directory is in PATH for this script
export PATH="/home/vscode/.opencode/bin:$PATH"

if ! command -v rtk &> /dev/null; then
  echo "Installing rtk..."
  curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh || echo "WARNING: rtk install failed"
  echo "" | RTK_TELEMETRY_DISABLED=1 rtk init -g --opencode 2>/dev/null || true
fi

# Install codegraph cli(required for MCP)

# curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
# codegraph install --target=auto --location=local --yes


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

# Install dsh (DeepSeek Harness CLI) - pinned rc, allow-scripts whitelist for native deps (node-pty, koffi, dsh-subprocess-local)
export PATH="$(npm prefix -g)/bin:$PATH"
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
DSH_VERSION="0.1.1-rc.2"
if ! command -v dsh &> /dev/null || [[ "$(dsh --version 2>/dev/null)" != "$DSH_VERSION" ]]; then
  echo "Installing dsh v${DSH_VERSION}..."
  npm install -g --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs "@deepseek-ai/dsh@${DSH_VERSION}" || echo "WARNING: dsh install failed"
else
  echo "dsh v${DSH_VERSION} already installed"
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
    "@deepseek-ai/dsh-subagent-dsh-sdk@0.1.1-rc.2" \
    "@deepseek-ai/dsh-sdk-client@0.1.1-rc.2" \
    "@deepseek-ai/dsh-sdk-jsonrpc-demo@0.1.1-rc.2" \
    "@deepseek-ai/dsh-sdk-jsonrpc-server@0.1.1-rc.2" \
    || echo "WARNING: could not add dsh-sdk subagent packages to the web profile"
fi

# 2) The child harness runtime (own tools: bash, fs, ask-user, todo, MCP
#    gateway client) is materialized from the repo into the persistent home and
#    its pinned dependencies installed when node_modules is absent.
if [[ -f "$DSH_SEED_DIR/child-runtime/package.json" ]]; then
  mkdir -p "$DSH_HOME/child-runtime"
  cp -f "$DSH_SEED_DIR/child-runtime/package.json" "$DSH_HOME/child-runtime/package.json" || true
  cp -f "$DSH_SEED_DIR/child-runtime/pnpm-workspace.yaml" "$DSH_HOME/child-runtime/pnpm-workspace.yaml" 2>/dev/null || true
  cp -f "$DSH_SEED_DIR/child-runtime/cordis.yml" "$DSH_HOME/child-runtime/cordis.yml" || true
  cp -f "$DSH_SEED_DIR/child-runtime/pnpm-lock.yaml" "$DSH_HOME/child-runtime/pnpm-lock.yaml" 2>/dev/null || true
  command -v pnpm &> /dev/null || npm install -g pnpm@10 || echo "WARNING: pnpm install failed"
  if [[ ! -d "$DSH_HOME/child-runtime/node_modules" ]]; then
    echo "Installing child harness runtime dependencies (Option B worker)..."
    (cd "$DSH_HOME/child-runtime" && pnpm install --frozen-lockfile) \
      || echo "WARNING: child harness runtime install failed"
  fi
  # 3) Isolated dsh home for child processes so their sessions never collide
  #    with the parent's (the provider passes DSH_HOME=~/.dsh/child-home).
  mkdir -p "$DSH_HOME/child-home"
fi
# NOTE: after a fresh container, restart the dsh host once (or boot the web
# profile) so the `dsh-sdk` provider row in cordis.patch.yml registers; then a
# session on the `orch-worker` preset gets a working `worker` tool.

echo "Setup complete!"
