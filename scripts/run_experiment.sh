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

# ── Helper: call Copilot to fix errors ───────────────────────────────────────
# Resumes the most recent session with --continue so Copilot retains full
# context of the changes it already made.
# Usage: fix_errors <kind> <error-output>
fix_errors() {
  local kind="$1"
  local errors="$2"
  echo "::warning::${kind} errors detected — invoking Copilot to fix..."
  copilot \
    --continue \
    --model "$MODEL" \
    --prompt "The following ${kind} errors were produced after your last change.
Fix them without altering the intent of the code.
Do not modify files under tests/ or .github/.

${errors}" \
    --allow-all-tools \
    --deny-tool='shell(git push)' \
    --deny-tool='shell(git commit)' \
    --deny-tool='shell(git checkout)'
}

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

# ── Validate changes (with one auto-fix attempt per tool) ────────────────────
if ! TEST_OUT=$(just test 2>&1); then
  fix_errors "pytest" "$TEST_OUT"
  # Re-run; fail hard if still broken
  just test
fi

if ! LINT_OUT=$(just lint 2>&1); then
  fix_errors "ruff" "$LINT_OUT"
  # Re-run; fail hard if still broken
  just lint
fi

# -- Check ollama status.
just ollama-status

# ── Run evaluations; generate baseline candidate ───────────────────────────
just eval-ci "${BASELINE_ID:-auto_research}"
