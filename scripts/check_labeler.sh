#!/usr/bin/env bash
# Check that the labeler has write/admin/maintain access and that the
# repository has not exceeded MAX_RUNS experiment runs in the last hour.
# Required env: GH_TOKEN, ACTOR, REPO, MAX_RUNS
set -euo pipefail

if ! PERM=$(gh api "repos/${REPO}/collaborators/${ACTOR}/permission" \
    --jq '.permission' 2>/tmp/gh_perm_err); then
  echo "::warning::Permission API call failed for '${ACTOR}' ($(cat /tmp/gh_perm_err || echo 'unknown error')) — defaulting to 'none'."
  PERM='none'
fi
if [[ "$PERM" != "admin" && "$PERM" != "write" && "$PERM" != "maintain" ]]; then
  echo "::error::Labeler '${ACTOR}' has permission '${PERM}' — write or higher is required to trigger experiments."
  exit 1
fi
echo "Labeler ${ACTOR} has permission: ${PERM} ✓"

WINDOW_START=$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%SZ')
if ! RECENT=$(gh api "repos/${REPO}/actions/workflows/experiment.yml/runs?per_page=100" \
  --jq "[.workflow_runs[] \
        | select(.created_at > \"${WINDOW_START}\") \
        | select(.status == \"queued\" or .status == \"in_progress\" or .status == \"completed\")] \
       | length"); then
  echo "::error::Rate limit check failed: unable to query recent experiment runs."
  exit 1
fi
if [[ ! "${RECENT}" =~ ^[0-9]+$ ]]; then
  echo "::error::Rate limit check failed: expected numeric run count, got '${RECENT}'."
  exit 1
fi
if [ "${RECENT}" -ge "${MAX_RUNS}" ]; then
  echo "::error::Rate limit exceeded: ${RECENT} experiment run(s) created in the last hour (max ${MAX_RUNS}). Please wait before re-labelling."
  exit 1
fi
echo "Rate limit OK: ${RECENT}/${MAX_RUNS} runs in the last hour ✓"
