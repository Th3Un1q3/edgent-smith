# Basic project tasks for this repo.
# Use `just <recipe>` to run the common workflow commands.

set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load
set dotenv-override
set export

UV := "uv"
PYTEST := "${UV} run pytest"
RUFF := "${UV} run ruff"
MYPY := "${UV} run mypy"
EVAL := "${UV} run python evals/runner.py"
CHECK_PATHS := "."

# Run the unit test suite.
test *ARGS="tests/ -q":
  {{PYTEST}} {{ARGS}}

# Run static lint checks.
lint:
  {{RUFF}} check {{CHECK_PATHS}}

# Run static type checking for runtime code.
typecheck:
  {{MYPY}} {{CHECK_PATHS}}

# Run the CI check sequence with aggregated failure reporting.
ci:
  @bash scripts/ci.sh

# Run the Python autofix workflow using the hooks defined in autofix.toml.
fix *ARGS:
  {{UV}} run python -m cli autoresearch fix {{ARGS}}

# Run the eval runner with the default model.
# Arguments after the baseline ID are forwarded directly to the underlying
# Python script (for example: `--set smoke`, `--set extended`, `--baseline-id`, `--model`).
eval baseline_id="edge_agent_default" *ARGS:
  {{EVAL}} --baseline-id {{baseline_id}} {{ARGS}}

# For local development: run only the fast 'smoke' dataset.
# Example: `just eval-local` -> `python evals/runner.py --baseline-id local_openrouter --set smoke --model edge_agent_local_openrouter`
eval-local:
  {{EVAL}} --baseline-id local_openrouter --set smoke --model edge_agent_local_openrouter

# For CI: run all available datasets to detect regressions across sets.
# We explicitly pass the known sets to ensure CI stability.
eval-ci:
  {{EVAL}} --baseline-id auto_research

# Output candidate vs baseline status for the requested baseline ID.
baseline-status baseline_id:
  @bash scripts/baseline_status.sh "{{baseline_id}}"

# Script-backed experiment runner entrypoint: promote a candidate baseline when its score is higher than the current baseline.
promote-baseline baseline_id:
  {{UV}} run python scripts/experiment.py promote-baseline --baseline-id "{{baseline_id}}"


# Pull the model before running the experiment.
pull-ollama-model:
  bash scripts/pull_ollama_model.sh

oc *ARGS:
  opencode {{ARGS}}

# Script-backed experiment runner entrypoint: run experiment execution locally with a prompt.
# This is separate from the `autoresearch experiment` local experiment registry CRUD surface.
# The prompt is required; additional flags are forwarded to experiment.py.
#
# Local behaviour vs CI:
#   - No git push (the workflow owns all git operations).
#   - No GitHub issue labels or comments (workflow-only side effects).
#   - State is written to experiments/manual.state.json.
#   - Pass --local to signal local-only mode (no-op today, available for hooks).
run-experiment prompt *ARGS:
  {{UV}} run python scripts/experiment.py run \
    --prompt '{{prompt}}' \
    --local \
    {{ ARGS }}

# Script-backed experiment runner entrypoint: run the local foreground experiment loop.
# Arguments are forwarded directly to the local-loop command in experiment.py.
alias experiment-loop := run-experiment-loop
run-experiment-loop *ARGS:
  {{UV}} run python scripts/experiment.py local-loop {{ARGS}}

# Transform vscode mcp config to copilot cli mcp config.
dev-sync-mcp:
  scripts/transform_mcp_json.sh

# Fix formatting and lint issues where supported.
format:
  {{RUFF}} format {{CHECK_PATHS}}
  {{RUFF}} check --fix {{CHECK_PATHS}}

# Validate formatting without modifying files
format-check:
  {{RUFF}} format --check {{CHECK_PATHS}}

# Click-backed public CLI surface: `init`, `validate`, `design`, `fix`, and `experiment`.
# `validate` accepts `--config PATH`; otherwise it auto-discovers the first `*.config.toml` file.
# `experiment` is the local experiment registry CRUD surface only; execution stays on the script-backed recipes above.
# Usage: just autoresearch <subcommand> [args]
[positional-arguments]
autoresearch +ARGS:
  #!/usr/bin/env bash
  set -euo pipefail
  {{UV}} run python -m cli autoresearch "$@"

# Run the edge agent with timing, tools used, output, and local OTLP trace metadata.
edge-agent prompt:
  #!/usr/bin/env bash
  set -euxo pipefail
  echo "Executing edge agent with local OpenRouter model and OTLP tracing."
  PROMPT="{{prompt}}" EDGENT_MODEL_ALIAS=edge_agent_local_openrouter {{UV}} run python agents/edge.py

# Print the current Ollama status.
ollama-status:
  #!/usr/bin/env bash
  set -euxo pipefail
  {{UV}} run python scripts/ollama_status.py

# Clean local caches created by tools.
clean:
  rm -rf .mypy_cache .ruff_cache
