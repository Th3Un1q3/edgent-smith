#!/usr/bin/env bash
# Usage: MODEL=<model> PROMPT=<prompt> bash scripts/run_experiment.sh
#
# Inputs (environment variables):
#   MODEL   — Copilot model name to pass to the CLI (e.g. gpt-4o-mini)
#   PROMPT  — Full prompt string to send to the Copilot CLI
set -euo pipefail

: "${MODEL:?MODEL environment variable is required}"
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

# ── Pull Ollama model via the devcontainer sidecar ───────────────────────────
if [[ -n "${EDGENT_MODEL_NAME:-}" ]]; then
  OLLAMA_BASE_URL="${EDGENT_OLLAMA_BASE_URL:-http://ollama:11434}"
  echo "Pulling '${EDGENT_MODEL_NAME}' from ${OLLAMA_BASE_URL} ..."
  curl --fail --silent --show-error \
    "${OLLAMA_BASE_URL}/api/pull" \
    -d "{\"model\":\"${EDGENT_MODEL_NAME}\"}" \
    | grep -E '"status"|"error"' || true
fi

# ── Invoke Copilot CLI ────────────────────────────────────────────────────────
copilot \
  --agent implement \
  --model "$MODEL" \
  --prompt "$PROMPT" \
  --allow-all-tools \
  --deny-tool='shell(git push)' \
  --deny-tool='shell(git commit)' \
  --deny-tool='shell(git checkout)'

# ── Validate changes (with one auto-fix attempt per tool) ────────────────────
if ! TEST_OUT=$(python -m pytest tests/ -q 2>&1); then
  fix_errors "pytest" "$TEST_OUT"
  # Re-run; fail hard if still broken
  python -m pytest tests/ -q
fi

if ! LINT_OUT=$(python -m ruff check agents/ evals/ tests/ 2>&1); then
  fix_errors "ruff" "$LINT_OUT"
  # Re-run; fail hard if still broken
  python -m ruff check agents/ evals/ tests/
fi

# ── Run evaluations; write score report; update baseline ──────────────────────
python evals/runner.py --score-file eval_result.json --update-baseline
