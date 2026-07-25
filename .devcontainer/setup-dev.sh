#!/usr/bin/env bash
set -euo pipefail

echo "Starting development environment setup..."

# Enable persistence volume for opencode
mkdir -p /home/vscode/.local/
sudo chown -R $(id -u):$(id -g) /home/vscode/.local/

# Ensure opencode bin directory is in PATH for this script
export PATH="/home/vscode/.opencode/bin:$PATH"

if ! command -v opencode &> /dev/null; then
  echo "Installing opencode..."
  OPENCODE_VERSION="1.18.4"
  for i in 1 2 3; do
    if curl -fsSL https://opencode.ai/install | bash -s -- --version "$OPENCODE_VERSION"; then
      echo "opencode v$OPENCODE_VERSION installed successfully"
      break
    else
      echo "Attempt $i/3 failed. Retrying in $((i * 2)) seconds..."
      sleep $((i * 2))
    fi
  done
  if ! command -v opencode &> /dev/null; then
    echo "Warning: opencode installation failed after 3 attempts. Continuing..."
  fi
fi

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


echo "Setup complete!"
