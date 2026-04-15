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

# Attempt automatic lint and type fixes, then fall back to Copilot CLI for remaining issues.
fix:
  bash scripts/fix_code.sh

# Run the smoke eval runner with the default model.
eval:
  {{EVAL}}

# Run the smoke eval suite for local development.
eval-local:
  {{EVAL}} --baseline-id edge_agent_debug

# Run the smoke eval suite in CI mode.
eval-ci baseline_id="auto_research":
  {{EVAL}} --baseline-id {{baseline_id}}

# Output candidate vs baseline status for the requested baseline ID.
baseline-status baseline_id:
  bash scripts/baseline_status.sh "{{baseline_id}}"

# Promote a candidate baseline when its score is higher than the current baseline.
promote-baseline baseline_id:
  bash scripts/promote_baseline.sh "{{baseline_id}}"

# Run the Copilot experiment runner locally with a prompt.
run-experiment prompt:
  bash scripts/pull_ollama_model.sh
  PROMPT="{{prompt}}" bash scripts/run_experiment.sh
  
# Transform vscode mcp config to copilot cli mcp config.
dev-sync-mcp:
  scripts/transform_mcp_json.sh

# Fix formatting and lint issues where supported.
format:
  {{RUFF}} check --fix agents/ evals/ tests/

# Run the edge agent with timing, tools used, and output.
edge-agent prompt:
  #!/usr/bin/env bash
  set -euxo pipefail
  bash scripts/pull_ollama_model.sh
  echo "Ollama status impacts performance of the agent."
  just ollama-status
  echo "Executing agent, this might take a few minutes. Please wait."
  PROMPT="{{prompt}}" {{UV}} run python agents/edge.py

# Print the current Ollama status.
ollama-status:
  #!/usr/bin/env bash
  set -euxo pipefail
  {{UV}} run python scripts/ollama_status.py

# Clean local caches created by tools.
clean:
  rm -rf .mypy_cache .ruff_cache
