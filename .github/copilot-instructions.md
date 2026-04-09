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
# GITHUB_COPILOT_API_TOKEN is forwarded automatically (see docker-compose.yml)
devcontainer up --workspace-folder .

# If devcontainer CLI fails (e.g. build error in CI), start containers directly:
docker compose -f .devcontainer/docker-compose.yml up -d

# Run commands inside the container
docker exec devcontainer-devcontainer-1 bash -c "cd /workspace && python evals/ollama_runner.py"
```

If Ollama is unreachable (no network access to registry.ollama.ai) use the
Copilot API fallback — see **Running evals without Ollama** below.
The Copilot API is reachable from inside the DevContainer because
`docker-compose.yml` forwards the token and sets `SSL_CERT_FILE` to the
system CA bundle (which trusts the sandbox TLS proxy).

## Eval runner architecture

Eval runners follow the **strategy pattern**: provider-specific model construction
is isolated in each runner; shared eval loop logic lives in `evals/runner.py`.

| File | Role |
|------|------|
| `evals/runner.py` | Shared `run_eval()` function – evaluate, score, baseline, report |
| `evals/ollama_runner.py` | Builds an Ollama-backed model and calls `run_eval()` |
| `evals/copilot_runner.py` | Builds a Copilot-backed model and calls `run_eval()` |
| `evals/smoke.py` | Dataset, evaluators, and utilities; delegates `__main__` to `run_eval()` |

The edge agent (`agents/edge.py`) is **model-agnostic**: it holds a plain string
model and never references a provider.  The runner selects and injects the model
at call-time via `agent.run(prompt, model=model)`.

## Running evals without Ollama

When the Ollama registry is not reachable (e.g., in the Copilot agent sandbox),
run evals against the GitHub Copilot API using the version-controlled runner.

The `docker-compose.yml` already forwards `GITHUB_COPILOT_API_TOKEN` and
`SSL_CERT_FILE` into the container, so no special setup is needed beyond
starting the DevContainer with the token present in the host environment.

```bash
# Start the DevContainer (token is forwarded automatically)
devcontainer up --workspace-folder .

# Run evals via Copilot API inside the DevContainer
docker exec devcontainer-devcontainer-1 \
  bash -c "cd /workspace && python evals/copilot_runner.py"

# Write a score file (same format as evals/ollama_runner.py --score-file)
docker exec devcontainer-devcontainer-1 \
  bash -c "cd /workspace && python evals/copilot_runner.py --score-file /tmp/score.json"

# Update the baseline when the new score beats the current one
docker exec devcontainer-devcontainer-1 \
  bash -c "cd /workspace && python evals/copilot_runner.py --update-baseline"
```

`evals/copilot_runner.py` runs the **same** smoke dataset and the **same**
edge agent as `evals/ollama_runner.py`.  The only difference is the model
backend, so the full agent (system prompt + all registered tools) is exercised.

## Scripts must be version-controlled

**Never write scripts to `/tmp` or any other ephemeral location.**

Any script you create for running evaluations, experiments, or diagnostics
**must be committed to the repository** in an appropriate location:

| Purpose | Location |
|---------|----------|
| Eval runner variant | `evals/<name>.py` |
| One-off experiment helper | `experiments/<name>.py` |
| Build / CI helper | `scripts/<name>.sh` |

## Design principles

When integrating with an external provider or library, identify the constructs
that are both available and recommended by that library using the tools at your
disposal (context7, documentation search).  Prefer patterns that allow future
extensibility without requiring changes to the core agent.

When adding a new capability that already has a parallel implementation (e.g. a
second runner), extract the shared logic first so each new variant only has to
supply what is genuinely different.

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
