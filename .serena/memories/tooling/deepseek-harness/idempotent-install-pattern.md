# Idempotent Devcontainer Install Pattern

Reuse for ANY future npm/CLI tool persisted in this devcontainer:

- Version-checked install guard: reinstall only on version mismatch (e.g. `dsh --version` comparison), never a plain `command -v` presence check.
- `cp -u` config restore (newer-file wins), guarded by `[[ -f ]]` conditionals.
- Conditionals safe under `set -euo pipefail`.

Known bug: the pre-existing `command -v gh` guard for @github/copilot never reinstalls — fix when next touching that block.

Applied in: mem:tooling/deepseek-harness/install-pinning.