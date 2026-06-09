# DevContainer Setup Guide
Instructions for initializing the development environment and verifying core dependencies.

1. **Automatic Setup**: The environment runs `uv sync` and installs `huggingface_hub` and `conductor` automatically on creation.
2. **Node Dependencies**: `npm install -g @github/copilot` is executed during setup.
3. **Remote User**: The environment defaults to the `vscode` user.

Example:
```bash
uv sync --dev --all-extras
```

Reference: .devcontainer/devcontainer.json
