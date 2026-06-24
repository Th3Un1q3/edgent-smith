#!/usr/bin/env bash
set -euo pipefail

echo "Starting development environment setup..."

# Enable persistance volume for opencode
sudo chown -R $(id -u):$(id -g) /home/vscode/.local/

if ! command -v opencode &> /dev/null; then
  echo "Installing opencode..."
  curl -fsSL https://opencode.ai/install | bash
fi


if ! command -v rtk &> /dev/null; then
  echo "Installing rtk..."
  curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
  # rtk init -g --opencode # FIXME - it seems to break tools an permissions, disabiling it for now
fi

# Install codegraph cli(required for MCP)

curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
codegraph install --target=auto --location=local --yes


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


echo "Setup complete!"
