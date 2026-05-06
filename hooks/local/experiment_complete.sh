#!/usr/bin/env bash
set -euo pipefail

: "${EXPERIMENT_REPO_ROOT:?}"
: "${EXPERIMENT_ITERATION:?}"
: "${EXPERIMENT_BASELINE_ID:?}"
: "${EXPERIMENT_STATUS:?}"
: "${EXPERIMENT_IMPROVED:?}"
: "${EXPERIMENT_CANDIDATE_PATH:?}"

log_path="${EXPERIMENT_REPO_ROOT}/experiments/local_loop_history.log"
mkdir -p "$(dirname "${log_path}")"

printf '%s\titeration=%s\tbaseline=%s\tstatus=%s\timproved=%s\tbaseline_score=%s\tcandidate_score=%s\tcandidate=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "${EXPERIMENT_ITERATION}" \
  "${EXPERIMENT_BASELINE_ID}" \
  "${EXPERIMENT_STATUS}" \
  "${EXPERIMENT_IMPROVED}" \
  "${EXPERIMENT_BASELINE_SCORE:-}" \
  "${EXPERIMENT_CANDIDATE_SCORE:-}" \
  "${EXPERIMENT_CANDIDATE_PATH}" \
  >>"${log_path}"