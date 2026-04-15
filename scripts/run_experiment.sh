#!/usr/bin/env bash
# Usage: PROMPT=<prompt> [MODEL=<model>] bash scripts/run_experiment.sh
#
# Inputs (environment variables):
#   MODEL   — Optional; Copilot model name to pass to the CLI (default: gpt-5-mini)
#   PROMPT  — Full prompt string to send to the Copilot CLI
set -euo pipefail

# Default MODEL to gpt-5-mini when not provided
MODEL="${MODEL:-gpt-5-mini}"
: "${PROMPT:?PROMPT environment variable is required}"

# ── Invoke Copilot CLI ────────────────────────────────────────────────────────
copilot \
  --agent implement \
  --autopilot \
  --model "$MODEL" \
  --prompt "$PROMPT" \
  --allow-all-tools \
  --deny-tool='shell(git push)' \
  --deny-tool='shell(git commit)' \
  --deny-tool='shell(git checkout)'

just fix

# -- Check ollama status.
just ollama-status

# ── Run evaluations; generate baseline candidate ───────────────────────────
just eval-ci "${BASELINE_ID:-auto_research}"
