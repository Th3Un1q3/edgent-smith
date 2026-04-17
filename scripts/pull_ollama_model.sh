#!/usr/bin/env bash
# Usage: [OLLAMA_MODEL_NAME=<model>] bash scripts/pull_ollama_model.sh
set -euo pipefail

OLLAMA_MODEL_NAME="${OLLAMA_MODEL_NAME:-gemma4:e2b}"
OLLAMA_PULL_URL="${OLLAMA_PULL_URL:-http://ollama:11434/api/pull}"

echo "Pulling '${OLLAMA_MODEL_NAME}' from ${OLLAMA_PULL_URL} ..."
curl --fail --silent --show-error \
  "${OLLAMA_PULL_URL}" \
  -d "{\"model\":\"${OLLAMA_MODEL_NAME}\"}" \
  | grep -E '"status"|"error"' || true
