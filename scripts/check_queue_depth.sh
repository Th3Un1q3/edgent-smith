#!/usr/bin/env bash
# Query open auto-research issues, excluding terminal-labelled ones.
# Required env: GH_TOKEN, REPO, GITHUB_OUTPUT
set -euo pipefail

queue_count=$(gh issue list \
  --repo "$REPO" \
  --state open \
  --label "auto-research" \
  --search '-label:"experiment-success" -label:"experiment-failure"' \
  --json number \
  --jq 'length')

echo "queue_count=${queue_count}" >> "$GITHUB_OUTPUT"
if [[ "${queue_count}" -eq 0 ]]; then
  echo "queue_empty=true" >> "$GITHUB_OUTPUT"
else
  echo "queue_empty=false" >> "$GITHUB_OUTPUT"
fi
