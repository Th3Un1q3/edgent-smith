# Basic project tasks for this repo.
# Use `just <recipe>` to run the common workflow commands.

set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load
set export

UV := "uv"
PYTEST := "${UV} run pytest tests/ -q"
RUFF := "${UV} run ruff"
MYPY := "${UV} run mypy"
EVAL := "${UV} run python evals/runner.py"

# Run the unit test suite.
test:
  {{PYTEST}}

# Run static lint checks.
lint:
  {{RUFF}} check agents/ evals/ tests/

# Run static type checking for runtime code.
typecheck:
  {{MYPY}} agents/ evals/

# Run the smoke eval runner with the default model.
eval:
  {{EVAL}}

# Run the Copilot experiment runner locally with a prompt.
execute-experiment prompt:
  PROMPT="{{prompt}}" bash scripts/run_experiment.sh

# Transform vscode mcp config to copilot cli mcp config.
dev-sync-mcp:
  scripts/transform_mcp_json.sh

# Fix formatting and lint issues where supported.
format:
  {{RUFF}} check --fix agents/ evals/ tests/

# Clean local caches created by tools.
clean:
  rm -rf .mypy_cache .ruff_cache
