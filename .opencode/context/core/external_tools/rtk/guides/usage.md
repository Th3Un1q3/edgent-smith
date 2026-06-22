# Using rtk in OpenCode

To maximize efficiency, wrap common shell commands with `rtk` when executing tasks to reduce token consumption.

## Installation (DevContainer Pattern)
In this project, manual installations are transient. To ensure persistence within the DevContainer environment:
1. **DO NOT** run installation scripts manually for permanent tools.
2. **ALWAYS** add the installation command to `.devcontainer/setup-dev.sh`.

Current configuration in `.devcontainer/setup-dev.sh`:
```bash
if ! command -v rtk &> /dev/null; then
  echo "Installing rtk..."
  curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
fi
```

## Recommended Workflow
* Instead of: `git status` $\rightarrow$ Use: `rtk git status` (returns compact, token-optimized version).
* Instead of: `ls -la` $\rightarrow$ Use: `rtk ls` (converts verbose directory listings into condensed trees).

## Configuration
Configuration is managed via a TOML file at `~/.config/rtk/config.toml`. 
We have configured it to use **Tee Mode** (`mode = "failures"`) which allows full output on failures for debugging while keeping standard command outputs token-optimized.