#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

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
  else
    cat "$output_file"
    summary="$(summarize_output "$output_file")"
    [ -n "$summary" ] || summary="No output captured."
    message=$(escape_workflow_command "$(printf '%s\n%s' "$name failed" "$summary")")
    echo "::error title=$name failed::$message"
    status=1
  fi

  rm -f "$output_file"
}

run_check format-check just format-check
run_check lint just lint
run_check typecheck just typecheck
run_check test just test
run_check workflow-security uv run python scripts/validate_workflow_security.py

exit "$status"