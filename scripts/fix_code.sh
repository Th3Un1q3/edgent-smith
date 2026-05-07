#!/usr/bin/env bash
# Compatibility wrapper for legacy callers.
# The Python CLI owns the autofix workflow.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

exec uv run python -m cli autoresearch fix "$@"
