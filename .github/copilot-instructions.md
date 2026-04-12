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
docker exec devcontainer-devcontainer-1 bash -c "cd /workspace && python evals/runner.py"
```

If Ollama is unreachable (no network access to registry.ollama.ai) set
`GITHUB_COPILOT_API_TOKEN` in the host environment; the runner will
auto-detect it and use the Copilot API instead.
The Copilot API is reachable from inside the DevContainer because
`docker-compose.yml` forwards the token and sets `SSL_CERT_FILE` to the
system CA bundle (which trusts the sandbox TLS proxy).

## Eval runner architecture

`evals/runner.py` is the single entry point for all evals.  It contains the
model factories for both providers, the shared eval loop, and a `__main__`
that auto-detects the provider from the environment.

| File | Role |
|------|------|
| `evals/runner.py` | Model factories, `run_eval()`, unified `__main__` |
| `evals/smoke.py` | Dataset, evaluators, and utilities |

The edge agent (`agents/edge.py`) is **model-agnostic**: it holds a plain string
model and never references a provider.  The runner selects and injects the model
at call-time via `agent.run(prompt, model=model)`.

## Running evals

```bash
# Start the DevContainer (token is forwarded automatically)
devcontainer up --workspace-folder .

# Auto-detect provider (copilot if GITHUB_COPILOT_API_TOKEN is set, else ollama)
docker exec devcontainer-devcontainer-1 \
  bash -c "cd /workspace && python evals/runner.py"

# Force a specific provider
docker exec devcontainer-devcontainer-1 \
  bash -c "cd /workspace && python evals/runner.py --provider copilot"

docker exec devcontainer-devcontainer-1 \
  bash -c "cd /workspace && python evals/runner.py --provider ollama --model gemma4:e2b"

# Write a score file and update the baseline
docker exec devcontainer-devcontainer-1 \
  bash -c "cd /workspace && python evals/runner.py --score-file /tmp/score.json --update-baseline"
```

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

## Working with unfamiliar tools or APIs

When you encounter a tool, action, CLI flag, or API whose correct behaviour is
not obvious from the code alone, follow this process every time — do not guess.

1. **Identify the issue.** State precisely what is unclear or broken.
2. **Find authoritative sources.** In order of preference:
   - Official documentation (linked from the repo, README, or action metadata)
   - `--help` / `man` output for CLI tools
   - Context7 (`context7-resolve-library-id` → `context7-query-docs`)
   - GitHub source / release notes for the specific version in use
3. **Derive the solution from what the sources say** — not from memory or
   analogy.  Quote or cite the relevant passage so the reasoning is traceable.
4. **Apply** the minimal change that resolves the issue consistently across
   every place the same pattern appears.  Do not fix one call site while leaving
   others broken.
5. **Validate** — run the relevant tests, linter, or CI job to confirm the fix
   works before marking the task done.

> **Example — `devcontainers/ci` env-passing.**
> The [action docs](https://github.com/devcontainers/ci/blob/main/docs/github-action.md#environment-variables)
> state that step-level `env:` is not forwarded into the container shell; only
> variables listed under `with.env` are available inside `runCmd`.  Applying
> that rule uniformly means: bind every `${{ }}` expression to a runner-level
> env var, list it in `with.env`, and reference it as a plain shell variable
> inside `runCmd` — with no inline `${{ }}` expressions anywhere in the shell
> body.

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
