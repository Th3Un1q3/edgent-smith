#!/usr/bin/env bash
set -euo pipefail

: "${EXPERIMENT_DRAFT_PATH:?}"
: "${EXPERIMENT_TITLE_PATH:?}"
: "${EXPERIMENT_BODY_PATH:?}"
: "${EXPERIMENT_ITERATION:?}"

if [[ -f "${EXPERIMENT_DRAFT_PATH}" || -f "${EXPERIMENT_TITLE_PATH}" || -f "${EXPERIMENT_BODY_PATH}" ]]; then
  exit 0
fi

mkdir -p "$(dirname "${EXPERIMENT_DRAFT_PATH}")"

cat >"${EXPERIMENT_DRAFT_PATH}" <<EOF
title: experiment: Local idea ${EXPERIMENT_ITERATION}
body: |
  Replace this placeholder with the experiment you want the local loop to run.
EOF

echo "Initialized ${EXPERIMENT_DRAFT_PATH}" >&2