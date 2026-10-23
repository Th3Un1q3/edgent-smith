---
name: justfiles
description: Best practices for writing justfiles to ensure maintainability, clarity, and consistency across projects.
applyTo: "{.*,**}/justfile"
excludeAgents: "rug"
---

# Best Practices for just tasks

Use `justfile` as the canonical source for project commands, not as a place for ad hoc shell scripts.

## 0. Module boundary — root is global gates only (enforced)

Root `justfile` owns exactly 11 global quality gates plus `mod` imports. No scoped recipe belongs in root. Every domain recipe lives in its module directory and runs as `just <module>::<recipe>`.

- **Root allows only:** `test`, `lint`, `typecheck`, `ci`, `ci-fast`, `format`, `format-check`, `clean`, `verify-agents`, `oc`, `oc-log` (11 globals) + `mod` imports. No other recipe in root.
- **Mods imported by root:** `mod? agent_utils`, `mod evals`, `mod scripts`, `mod docs`, `mod agents`, `mod cli`, `mod opencode` (`opencode/justfile` → `.opencode/justfile` symlink; fallback `just --justfile .opencode/justfile <recipe>`).
- **Scoped ownership (invoke as `just <module>::<recipe>`):** module paths, scope, and recipe examples live in root `AGENTS.md` → PROJECT STRUCTURE and CONVENTIONS. Do not restate them here; the module `justfile` owns its recipe names.

- **Rule — do not add to root:** Do not add a new recipe to root `justfile` unless it is a global quality gate with zero domain dependencies (`test`, `lint`, `typecheck`, `format`, `format-check`, `ci`, `clean`, `verify-agents`). For any domain-specific work, create or update the scoped `justfile` in that module directory, add the recipe there, and ensure root imports it via `mod <module>` or `mod? <module>`. If the module has no `justfile` yet, create one with `set shell := ["bash", "-euo", "pipefail", "-c"]`, `set dotenv-load := true`, `set export := true`, `set working-directory := ".."` (when recipes reference repo root).
- **Enforcement — CI gate:** `just verify-agents` verifies the boundary (alongside its topology gates). It checks that root `justfile` contains only the 11 globals plus `mod` lines and that no scoped recipe (e.g., `eval`, `run-experiment`, `lint`, `edge-agent`, `autoresearch`) appears in root. CI (`just ci` → `scripts/ci.sh`) runs this gate. Fix a violation by moving the recipe to its scoped file and re-running `just verify-agents`.
- **Invocation:** From repo root, run `just <module>::<recipe>` (e.g., `just evals::local`, `just scripts::watch-worker`). Run `just --list` to see globals; scoped modules appear as `agent_utils ...`, `agents ...`, etc. — expand with `just --unstable --list` or read the module `justfile` directly.

## 0.1 Pre-check — run `just verify-agents` before editing justfiles (P0)

Before any `justfile` or `*/justfile` or `.github/workflows/*.yml` edit that touches `just` invocation:

1. Run `just verify-agents` (<2s). Require `── verify-agents: PASS ──` before committing. It checks the topology gates plus the justfile boundary and working-directory.
2. Enforce root boundary: exactly 11 globals (`test lint typecheck ci ci-fast format format-check clean verify-agents oc oc-log`) + 7 `mod` imports (`agent_utils evals scripts docs agents cli opencode`). Do not add domain recipes to root — move them to scoped `justfile` and invoke as `just <module>::<recipe>`. Gate fails if count drifts — fix by moving recipe.
3. Scoped justfiles must declare scope: add at top `set working-directory := ".."` (gate 9 requires 7 scoped files) and invoke with `--cwd` instead of `cd &&`. Example diff for `docs/justfile`:
   ```diff
   +set working-directory := ".."
     lint:
   -  cd docs && bun run lint
   +  bun run lint --cwd docs
   ```
4. Never use `cd <dir> &&` in a `justfile` recipe — use `working-directory` + `--cwd` or `workdir` param. Detect with self-match `grep "[c]d .*&&" --include="justfile"` (bracket avoids self-match on the grep line when copied into a gate).
5. Ensure `scripts/conductor/` exists: gate 5 runs `mkdir -p scripts/conductor && ls -la scripts/conductor/`. Keep `scripts/conductor/.gitkeep` tracked (`git ls-files scripts/conductor/.gitkeep`) so clean clones pass.
6. Pre-commit checklist — run `just verify-agents && just docs::lint && just typecheck` (<10s combined) before any `justfile`, `*.justfile`, `*.yml`, or `*.md` edit; block commit on fail. `just docs::lint` lints every markdown file matched by `.markdownlint-cli2.jsonc` globs (the run prints `Linting: <N> files`; 0 issues expected); `just typecheck` covers `mypy --strict` with `mypy_path = "stubs"`.

## 1. Syntax — the manual owns it

Recipe syntax, parameters, attributes, dependencies, imports, and functions are documented at <https://just.systems/man/en/>. Do not copy that reference here. Only the traps that have burned this repo:

- **Separate shells:** each recipe line runs in its own shell, so a variable or `cd` on one line is gone on the next. Wrap dependent lines in `( ... )` or use a `#!/usr/bin/env bash` recipe.
- **No `cd <dir> &&`:** see pre-check item 4; use `set working-directory`, a tool's `--cwd`, or a `( cd ...; ... )` subshell.
- **Recipe `#` lines are `just --list` output:** write the reason the recipe exists, not a narration of its commands.

## 2. Settings every repo justfile uses

Strict mode is not optional: `set shell := ["bash", "-euo", "pipefail", "-c"]`. Add `set dotenv-load := true`, `set export := true`, and `set working-directory := ".."` as the module requires (module boundary; pre-check item 3).

## 3. Quiet recipes when output is parsed

`just` echoes each command to stderr, which corrupts any JSON capture. Prefix the line or the recipe name with `@`, or use `set quiet` with `[no-quiet]` to opt out. Do not rely on a non-standard `--quiet` flag. For machine-readable output, call the underlying script directly, or quiet just that recipe:

```just
baseline-status baseline_id:
  @bash scripts/baseline_status.sh "{{baseline_id}}"
```

Validate captured output with `jq` and fail fast on a parse error.

## 4. Repo recipe patterns

Forward flags instead of enumerating them, and keep heavy setup in a dependency recipe.

```just
# Run the unit test suite with default path, or override with custom args.
test *ARGS="tests/":
  {{PYTEST}} {{ARGS}}
```

```just
pull-ollama-model:
  bash scripts/pull_ollama_model.sh

run-experiment prompt *ARGS: pull-ollama-model
  python scripts/experiment.py run \
    --prompt '{{prompt}}' \
    {{ ARGS }}
```

```bash
just run-experiment "My prompt" --baseline-id local --followup-limit 2 --agent implement
```

## Command Support Recipes

Recipes that support OpenCode commands follow `command-design.instructions.md` Principles 3–4 (reusable logic lives in justfile recipes; state is handled explicitly). Justfile-specific mechanics:

- **Working directory**: a recipe runs from the justfile's own directory unless `set working-directory` overrides it. With no override, reach the workspace root via absolute `/workspace/...` paths (or a relative path from the module directory) before using workspace-relative paths such as `.tmp/` or `.agents/`.
- **Placeholder matching**: a `sed` pattern must match the template string exactly; copy the placeholder from the template and test the recipe against the real template, or the substitution fails silently.
- **Schema verification**: `jq` field names must match the real JSON schema (e.g., `.info.model.providerID`, not `.provider`); verify against the schema reference before writing the query.
