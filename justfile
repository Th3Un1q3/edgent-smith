# Basic project tasks for this repo.
# Use `just <recipe>` to run the common workflow commands.
# Global quality gates only — scoped commands live in submodules: evals, scripts, docs, agents, cli, opencode.

set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load := true
set dotenv-override := true
set export := true

mod? agent_utils
mod evals
mod scripts
mod docs
mod agents
mod cli
mod opencode

UV := "uv"
PYTEST := "${UV} run pytest"
RUFF := "${UV} run ruff"
MYPY := "${UV} run mypy"
CHECK_PATHS := "."

# Run the unit test suite.
test *ARGS="tests/ -q":
    {{ PYTEST }} {{ ARGS }}

# Run static lint checks.
lint:
    {{ RUFF }} check {{ CHECK_PATHS }}

# Run static type checking for runtime code.
typecheck:
    {{ MYPY }} {{ CHECK_PATHS }}

# Run the CI check sequence with aggregated failure reporting.
ci:
    @bash scripts/ci.sh

# Fix formatting and lint issues where supported.
format:
    {{ RUFF }} format {{ CHECK_PATHS }}
    {{ RUFF }} check --fix {{ CHECK_PATHS }}

# Validate formatting without modifying files
format-check:
    {{ RUFF }} format --check {{ CHECK_PATHS }}

# Clean local caches created by tools.
clean:
    rm -rf .mypy_cache .ruff_cache

# Tail opencode logs
oc-log:
    tail -f ~/.local/share/opencode/log/opencode.log

# Run opencode
oc *ARGS:
    opencode {{ ARGS }}

# Verify AGENTS.md 8 grep gates stay in sync with repo topology (AGENTS.md:190-220) + justfile boundary
verify-agents:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "── verify-agents: 8 grep gates from AGENTS.md VALIDATION ──"
    echo "#1 System A (harness-free runtime)"
    grep -R "pydantic-ai" pyproject.toml && ls agents/edge.py config.py
    echo "#2 System B (harness-native DSH)"
    ls .dsh/cordis.patch.yml .dsh/child-runtime/cordis.yml
    echo "#3 OpenCode RUG"
    ls .opencode/agents/rug.md .opencode/plugins/helpers
    echo "#4 Copilot agents"
    ls .github/agents/*.agent.md
    echo "#5 Conductor"
    ls scripts/conductor/
    echo "#6 MCP catalog"
    ls mcp/catalog.yaml && grep -c "  type:" mcp/catalog.yaml && echo "mcp catalog OK"
    echo "#7 Skill marketplace"
    count=$(ls .agents/skills/ | wc -l); echo "skills: $count"; test "$count" -ge 1
    echo "#8 Justfile boundary (root is 10 globals + mods only)"
    allowed="test lint typecheck ci format format-check clean verify-agents oc oc-log"
    allowed_count=$(echo "$allowed" | wc -w)
    # count recipes in root justfile (lines starting with recipe name + colon)
    actual_recipes=$(grep -E "^[a-z][a-z0-9_-]*.*:" justfile | grep -v ":=" | sed -E 's/^([a-z][a-z0-9_-]*).*/\1/' | sort)
    actual_count=$(echo "$actual_recipes" | wc -w)
    echo "  allowed ($allowed_count): $allowed"
    echo "  actual  ($actual_count): $(echo $actual_recipes | tr '\n' ' ')"
    test "$actual_count" -eq "$allowed_count" || { echo "FAIL: root justfile has $actual_count recipes, expected $allowed_count"; echo "$actual_recipes"; exit 1; }
    for r in $allowed; do echo "$actual_recipes" | grep -qw "$r" || { echo "FAIL: missing allowed recipe $r in root justfile"; exit 1; }; done
    # no scoped recipes in root (skip names that are also global gates: lint, ci)
    for bad in eval local ci baseline-status promote-baseline pull-ollama-model run-experiment run-experiment-loop approve watch-worker inspect-session iterate-experiment lint fix deps serve edge-agent ollama-status autoresearch memory-viz git_todos notify list-skills; do
      if echo "$allowed" | grep -qw "$bad"; then continue; fi
      if echo "$actual_recipes" | grep -qw "$bad"; then echo "FAIL: scoped recipe '$bad' must not be in root justfile"; exit 1; fi
    done
    # verify mod imports
    mod_count=$(grep -cE "^mod\?? " justfile)
    echo "  mod imports: $mod_count (expected 7)"
    test "$mod_count" -eq 7 || { echo "FAIL: expected 7 mod imports in root justfile, got $mod_count"; exit 1; }
    grep -qE "^mod\? agent_utils" justfile || { echo "FAIL: missing mod? agent_utils"; exit 1; }
    grep -qE "^mod evals" justfile || { echo "FAIL: missing mod evals"; exit 1; }
    grep -qE "^mod scripts" justfile || { echo "FAIL: missing mod scripts"; exit 1; }
    echo "  justfile boundary OK"
    echo "── verify-agents: PASS ──"
