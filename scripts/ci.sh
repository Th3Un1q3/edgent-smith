#!/usr/bin/env bash
# scripts/ci.sh — local CI gate runner (12 gates, sequential).
# Gates (order matters):
#  1) verify-agents  2) format-check  3) lint  4) markdownlint  5) typecheck  6) test
#  7) workflow-security  8) opencode-deps  9) opencode-test  10) opencode-lint
# 11) opencode-typecheck  12) opencode-mutation (~92s dominant, ~110s total)
# Parity: remote PR CI runs `just ci` verbatim; keep this script, the `ci` justfile
# recipe, and .github/workflows/ci.yml in sync. The 12 gates must stay aligned with
# the harness.config.ts 7-gate subset (superset here).
# Fast path: SKIP_MUTATION=1 (or CI_FAST=1 alias) skips gate 12 — prints
# "→ SKIP opencode-mutation (SKIP_MUTATION=1)", counts as pass in Gate Summary,
# ~20s local iteration.
# Timeout: opencode-mutation is wrapped with `timeout ${MUTATION_TIMEOUT:-300}` when GNU timeout is
# available (default 300s, env MUTATION_TIMEOUT overrides); workflow-level timeouts are 12/20 min.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

results_dir=$(mktemp -d)
trap 'rm -rf "$results_dir"' EXIT

status=0

escape_workflow_command() {
  printf '%s' "$1" | sed ':a;N;$!ba;s/%/%25/g;s/\r/%0D/g;s/\n/%0A/g'
}

summarize_output() {
  local output_file=$1

  set +o pipefail
  tail -n 20 "$output_file" | LC_ALL=C tr -d '\000' | head -c 4000
}

run_check() {
  local name=$1
  local output_file
  local summary
  local message

  shift
  output_file=$(mktemp)

  echo "── $name ─────────────────────────────────"
  if "$@" >"$output_file" 2>&1; then
    cat "$output_file"
    printf pass >"$results_dir/$name"
  else
    cat "$output_file"
    summary="$(summarize_output "$output_file")"
    [ -n "$summary" ] || summary="No output captured."
    message=$(escape_workflow_command "$(printf '%s\n%s' "$name failed" "$summary")")
    echo "::error title=$name failed::$message"
    printf fail >"$results_dir/$name"
    status=1
  fi

  rm -f "$output_file"
}

run_check verify-agents just verify-agents
run_check format-check just format-check
run_check lint just lint
run_check markdownlint just docs::lint
run_check typecheck just typecheck
run_check test just test
run_check workflow-security uv run python scripts/validate_workflow_security.py
run_check opencode-deps just .opencode/deps
run_check opencode-test just .opencode/test --coverage
run_check opencode-lint just .opencode/lint
run_check opencode-typecheck just .opencode/typecheck
if [[ "${SKIP_MUTATION:-0}" == "1" || "${CI_FAST:-0}" == "1" ]]; then
  echo "→ SKIP opencode-mutation (SKIP_MUTATION=1)"
  printf pass >"$results_dir/opencode-mutation"
else
  _ci_mutation_timeout="${MUTATION_TIMEOUT:-300}"
  _ci_mutation_cmd=(just .opencode/mutation)
  if command -v timeout >/dev/null 2>&1; then
    _ci_mutation_cmd=(timeout "${_ci_mutation_timeout}" just .opencode/mutation)
  fi
  run_check opencode-mutation "${_ci_mutation_cmd[@]}"
fi

echo ""
echo "─── Gate Summary ───"
for result_file in "$results_dir"/*; do
  gate_name=$(basename "$result_file")
  gate_result=$(cat "$result_file")
  echo "$gate_name: $gate_result"
done

exit "$status"