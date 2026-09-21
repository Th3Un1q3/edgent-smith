#!/usr/bin/env bash
# scripts/ci_ensure_env.sh — host-side environment preparation for GitHub Actions.
# Must run before devcontainers/ci starts: the mounted workspace needs .env at
# container startup (see github-actions-tech-guidance.instructions.md).
#
#   bash scripts/ci_ensure_env.sh            # create .env if missing
#   bash scripts/ci_ensure_env.sh --no-infra # also truncate the compose env,
#                                            # disabling the infra profile
#                                            # (mcp_gateway, jaeger, serena)
#                                            # to mirror local --fast
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env created from .env.example"
else
  echo ".env already exists, skipping"
fi

if [ "${1:-}" = "--no-infra" ]; then
  # Truncate compose env (not root .env): disables infra profile services.
  : > .devcontainer/.env
fi
