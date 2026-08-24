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
  curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
  echo "" | RTK_TELEMETRY_DISABLED=1 rtk init -g --opencode 2>/dev/null || true
fi

# Install codegraph cli(required for MCP)

# curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
# codegraph install --target=auto --location=local --yes


echo "Running uv sync..."
uv sync --dev --all-extras

if ! uv tool list | grep -q "huggingface_hub"; then
  echo "Installing huggingface_hub..."
  uv tool install --force huggingface_hub
fi

if ! command -v gh &> /dev/null; then
  echo "Installing GitHub CLI via npm..."
  npm install -g @github/copilot
fi

if ! command -v conductor &> /dev/null; then
  echo "Installing conductor..."
  CONDUCTOR_INSTALL_FORCE=1 curl -sSfL https://aka.ms/conductor/install.sh | sh -s -- --source "git+https://github.com/microsoft/conductor.git@v0.1.18"
fi

# Install dsh (DeepSeek Harness CLI) - pinned rc, allow-scripts whitelist for native deps (node-pty, koffi, dsh-subprocess-local)
export PATH="$(npm prefix -g)/bin:$PATH"
# Ensure dsh home is writable (fresh dsh_data volume is root-owned on rebuild)
mkdir -p /home/vscode/.dsh
sudo chown -R $(id -u):$(id -g) /home/vscode/.dsh
DSH_VERSION="0.1.1-rc.2"
if ! command -v dsh &> /dev/null || [[ "$(dsh --version 2>/dev/null)" != "$DSH_VERSION" ]]; then
  echo "Installing dsh v${DSH_VERSION}..."
  npm install -g --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs "@deepseek-ai/dsh@${DSH_VERSION}"
else
  echo "dsh v${DSH_VERSION} already installed"
fi

# Restore dsh config from repo templates (config-as-code; user edits in ~/.dsh are kept)
if [[ -f /workspace/.devcontainer/dsh/settings.yaml ]]; then
  cp -u /workspace/.devcontainer/dsh/settings.yaml /home/vscode/.dsh/settings.yaml
  cp -u /workspace/.devcontainer/dsh/cordis.patch.yml /home/vscode/.dsh/cordis.patch.yml
fi

echo "Setup complete!"
