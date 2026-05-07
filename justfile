# Basic project tasks for this repo.
# Use `just <recipe>` to run the common workflow commands.

set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load
set dotenv-override
set export

UV := "uv"
PYTEST := "${UV} run pytest tests/ -q"
RUFF := "${UV} run ruff"
MYPY := "${UV} run mypy"
EVAL := "${UV} run python evals/runner.py"
CHECK_PATHS := "."

# Run the unit test suite.
test:
  {{PYTEST}}

# Run static lint checks.
lint:
  {{RUFF}} check {{CHECK_PATHS}}

# Run static type checking for runtime code.
typecheck:
  {{MYPY}} {{CHECK_PATHS}}

# Attempt automatic lint, type, and test fixes, then fall back to Copilot CLI for remaining issues.
fix *ARGS:
  bash scripts/fix_code.sh {{ARGS}}

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

# Promote a candidate baseline when its score is higher than the current baseline.
promote-baseline baseline_id:
  {{UV}} run python scripts/experiment.py promote-baseline --baseline-id "{{baseline_id}}"


# Pull the model before running the experiment.
pull-ollama-model:
  bash scripts/pull_ollama_model.sh

# Submit experiment design specification
experiment-submit-spec title description:
  mkdir -p experiments
  DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '%s\n' '---' "title: \"{{title}}\"" "date: ${DATE}" '---' '' "{{description}}" > experiments/candidate.md
  echo "Wrote experiments/candidate.md"
  git add experiments/candidate.md
  git diff --cached --quiet || git commit -m "experiment: add spec — {{title}}"

# Run the Copilot experiment runner locally with a prompt.
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

# Run the local foreground experiment loop.
# Arguments are forwarded directly to the local-loop command in experiment.py.
alias experiment-loop := run-experiment-loop
run-experiment-loop *ARGS:
  {{UV}} run python scripts/experiment.py local-loop {{ARGS}}

# Transform vscode mcp config to copilot cli mcp config.
dev-sync-mcp:
  scripts/transform_mcp_json.sh

# Fix formatting and lint issues where supported.
format:
  {{RUFF}} check --fix {{CHECK_PATHS}}

# Proxy commands to the CLI.
# Usage: just autoresearch <command>
autoresearch +ARGS:
  {{UV}} run python -m cli autoresearch {{ARGS}}

# Run the edge agent with timing, tools used, and output.
edge-agent prompt: pull-ollama-model ollama-status
  #!/usr/bin/env bash
  set -euxo pipefail
  echo "Ollama status impacts performance of the agent."
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
