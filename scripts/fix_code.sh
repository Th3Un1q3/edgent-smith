#!/usr/bin/env bash
# Usage: bash scripts/fix_code.sh
# Attempts automatic lint and type fixes, then falls back to Copilot CLI
# for remaining issues.
set -euo pipefail

MODEL="${MODEL:-gpt-5-mini}"

if ! command -v copilot >/dev/null 2>&1; then
  echo "error: Copilot CLI is required for fallback fixes. Install @github/copilot in the DevContainer." >&2
  exit 1
fi

run_ruff_fix() {
  uv run ruff check --fix agents/ evals/ tests/
}

run_ruff_check() {
  uv run ruff check agents/ evals/ tests/
}

run_mypy() {
  uv run mypy --install-types --non-interactive agents/ evals/
}

run_tests() {
  uv run pytest tests/ -q
}

fallback_fix() {
  local kind="$1"
  local errors="$2"

  echo "Copilot: fixing remaining ${kind} errors..."
  copilot \
    --autopilot \
    --model "$MODEL" \
    --prompt "The following ${kind} errors remain after automatic fixes. Fix them without changing the intent of the code. Do not modify files under or /.github/. You can only fix type or lint errors in test files, not test logic errors. ${kind^} errors:\n\n$

${errors}" \
    --allow-all-tools \
    --deny-tool='shell(git push)' \
    --deny-tool='shell(git commit)' \
    --deny-tool='shell(git checkout)'
}

# Attempt automatic fixes first.
run_ruff_fix || true

if ! run_ruff_check >/tmp/ruff_remaining.out 2>&1; then
  RUFF_ERRORS="$(cat /tmp/ruff_remaining.out)"
  fallback_fix "lint" "$RUFF_ERRORS"
  run_ruff_fix
  run_ruff_check
fi

if ! run_mypy >/tmp/mypy_remaining.out 2>&1; then
  MYPY_ERRORS="$(cat /tmp/mypy_remaining.out)"
  fallback_fix "type" "$MYPY_ERRORS"
  run_mypy
fi

if ! run_tests >/tmp/tests_remaining.out 2>&1; then
  TEST_ERRORS="$(cat /tmp/tests_remaining.out)"
  fallback_fix "test" "$TEST_ERRORS"
  run_tests
fi

echo "All lint, type, and test checks passed."
