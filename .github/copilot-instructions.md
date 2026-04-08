# Copilot Instructions – edgent-smith

This repository implements a minimal, edge-optimised agentic system.

## Three-agent architecture

| Agent | File | Role |
|---|---|---|
| Edge Agent | `agents/edge.py` | pydantic-ai agent; inline tools; executes core logic and orchestrates workflow |
| Brainstorm Agent | `.github/agents/brainstorm.agent.md` | Copilot custom agent; generates ideas; creates `auto-research` issues |
| Implementation Agent | `.github/agents/implement.agent.md` | Copilot custom agent; applies experiment changes to `agents/edge.py` |

## Before making any change

1. Check that your change is within the allowed mutation surface (see the active issue).
2. Run `pytest tests/ -q` to confirm tests pass.
3. Run `ruff check agents/ evals/ tests/` to confirm lint passes.

## Execution environment — MANDATORY

The sandbox host runs **Python 3.12**; this project requires **Python 3.13**.
The sandbox has **no Ollama daemon**.

**You must always execute Python inside the DevContainer**, not on the host.

```bash
# Install DevContainer CLI if missing
npm install -g @devcontainers/cli

# Start the DevContainer (Python 3.13 + Ollama sidecar)
devcontainer up --workspace-folder .

# Then run commands inside it
docker exec devcontainer-devcontainer-1 python evals/smoke.py
```

If Ollama is unreachable (no network access to registry.ollama.ai) use the
Copilot API fallback — see **Running evals without Ollama** below.

## Running evals without Ollama

When the Ollama registry is not reachable (e.g., in the Copilot agent sandbox),
run evals against the GitHub Copilot API using the version-controlled runner.

> **Important:** `api.githubcopilot.com` is reachable from the **sandbox host**
> but is blocked inside the DevContainer's Docker network.
> Run `evals/copilot_runner.py` from the **host**, not from inside the container.

```bash
# Install the package on the host (ignoring the Python 3.13 constraint)
pip install -e ".[dev]" --ignore-requires-python

# GITHUB_COPILOT_API_TOKEN is already set in the Copilot agent sandbox
python evals/copilot_runner.py

# Write a score file (same format as evals/smoke.py --score-file)
python evals/copilot_runner.py --score-file /tmp/score.json

# Update the baseline when the new score beats the current one
python evals/copilot_runner.py --update-baseline
```

`evals/copilot_runner.py` is the authoritative fallback runner.
It patches the missing `"object"` field that the Copilot endpoint omits, so
pydantic-ai parses responses correctly.

## Scripts must be version-controlled

**Never write scripts to `/tmp` or any other ephemeral location.**

Any script you create for running evaluations, experiments, or diagnostics
**must be committed to the repository** in an appropriate location:

| Purpose | Location |
|---------|----------|
| Eval runner variant | `evals/<name>.py` |
| One-off experiment helper | `experiments/<name>.py` |
| Build / CI helper | `scripts/<name>.sh` |

If you catch yourself writing `cat > /tmp/something.py`, stop and create the
file under the repo root instead.

## Verify that your work actually runs

Do not mark a task complete until you have:

1. Run the relevant command inside the DevContainer and seen it succeed.
2. Confirmed the output makes sense (score, test results, lint output).
3. Committed **all** files you created or modified — including runner scripts.

## Mutation boundaries

- **Allowed during experiments**: `agents/edge.py` (system prompt, tool descriptions), `evals/smoke.py` (cases only).
- **Never change**: CI workflows, devcontainer, `tests/`, this file.

## Agent definitions

GitHub Copilot custom agents live in `.github/agents/*.agent.md`.
They are invoked by the `auto-research` workflow via the GitHub Copilot CLI.

## Prompts

General prompts live in `.github/prompts/*.prompt.md`.

## Python runtime

Target Python 3.13. The codebase uses `from __future__ import annotations` for forward-reference compatibility; keep this import in all files.

## Dependencies

Use only `pydantic-ai[evals]` and `httpx`. Do not add new dependencies without approval.
