# Copilot Instructions – edgent-smith

This repository implements a minimal, edge-optimised agentic system.

## Three-agent architecture

| Agent | File | Role |
|---|---|---|
| Edge Agent | `agents/edge.py` | pydantic-ai agent; inline tools; executes core logic and orchestrates workflow |
| Brainstorm Agent | `.github/agents/brainstorm.agent.md` | Copilot custom agent; generates ideas; creates `auto-research` issues |
| Implementation Agent | `.github/agents/implement.agent.md` | Copilot custom agent; applies experiment changes to `agents/edge.py` |

## Before making any change

**Read this entire file** to understand the architecture, design principles, and validation process.  It contains critical information about how the system is structured, how to run tests and evals, and how to ensure your changes are correct and safe.

### Validation checklist (mandatory for any change that affects functionality)

This checklist applies to any change to the repository that affects code, functionality, evaluations, configuration, scripts, or runtime flags. Before marking a task done, complete these functional and non-functional validations.

#### Functional checks (what to run)

- **Run unit tests**: `pytest tests/ -q`. If you changed a specific module, run its tests directly (e.g. `pytest tests/test_config.py -q`).
- **Run the full test suite**: `pytest tests/ -q` to detect regressions across the repo.
- **Run CLI & integration smoke checks**: exercise the code paths a user or CI would run, for example:

```bash
# Exercise the edge agent prompt path (uses EDGENT_MODEL/DEVCONTAINER settings)
python agents/edge.py "What is 2+2?"

# Run the smoke eval runner (auto-detects provider); write a score file to inspect results
python evals/runner.py --score-file /tmp/score.json
```

#### Non-functional checks (static & regression)

- **Run linters & type checks**: `python -m ruff check agents/ evals/ tests/` and fix warnings; prefer built-in generics and `X | None` annotations for Python 3.13.
- **Validate mapping & parameter mapping logic**: add unit tests for `map_to_provider_params()` for each provider/endpoint touched; ensure `think`, `max_tokens`, and token caps map correctly.
- **Enforce safety caps**: verify `HARD_MAX_OUTPUT_TOKENS` (or equivalent) is applied — either via unit tests or a quick runtime check.
- **Secrets handling & logging checks**: ensure no secrets are printed in logs. Grep recent log outputs or run a brief script to confirm tokens are masked.

#### Integration & CI expectations

- **DevContainer execution**: run integration or smoke checks inside the DevContainer when appropriate (see DevContainer section). Do not assume host services match container networking.
- **Mock external calls in tests**: provider clients (Ollama/Copilot) must be mocked for unit tests; CI should run mocked tests to avoid network dependency.
- **Baseline/regression check for evals**: if changes affect the evals or agent behaviour, run `python evals/runner.py --score-file /tmp/score.json` and compare with the baseline in `evals/*.baseline.json`. Only update baseline files with `--update-baseline` when you have validated improvements and added tests.

#### Governance & documentation

- **Document changes**: update `.env.example`, `README.md`, and `docs/` with any new env vars, presets, or behavioural changes.
- **Add audit/log entries**: when changing which params are passed to providers, write a small (masked) audit line to `logs/model_params_audit.log` and include it in the PR so reviewers can see the effective params used.
- **Tests & coverage**: any behaviour change must be accompanied by unit tests demonstrating the expected behaviour and handling of edge cases.

#### Enforcement

Every time there is opportunity to automate checks, enforce them via CI. For example the change introduced new service in docker compose. Add step to check connectivity to that service in CI. If there is a new env var, add a check that it is set in CI. If there is a new eval, add a smoke check for it in CI. The goal is to catch any missed validation steps automatically and prevent regressions.

## Execution environment — MANDATORY

The sandbox host runs **Python 3.12**; this project requires **Python 3.13**.
The sandbox has **no Ollama daemon**.

**All Python commands must run inside the DevContainer.**
The `docker-compose.yml` sets `DEVCONTAINER=true` inside the container, so you
can always detect your environment reliably:

```bash
if [ "${DEVCONTAINER:-}" = "true" ]; then
  echo "Inside DevContainer - run commands directly"
else
  echo "Outside DevContainer - prefix commands with: devcontainer exec --workspace-folder . --"
fi
```

### If you are INSIDE the DevContainer

Run commands directly (no prefix needed):

```bash
python evals/runner.py
pytest tests/ -q
python -m ruff check agents/ evals/ tests/
```

### If you are OUTSIDE the DevContainer

Install the DevContainer CLI and start the container first:

```bash
# The devcontainer CLI is pre-installed via copilot-setup-steps.yml.
# If it is somehow missing, install it (requires Node.js 18+ on the host):
command -v devcontainer >/dev/null 2>&1 || npm install -g @devcontainers/cli

# Start the DevContainer (Python 3.13 + Ollama sidecar).
# The image is pre-built by copilot-setup-steps.yml, so this is usually instant.
# GITHUB_COPILOT_API_TOKEN and COPILOT_GITHUB_TOKEN are forwarded automatically
# (see docker-compose.yml).
devcontainer up --workspace-folder .
```

Then prefix every command with `devcontainer exec --workspace-folder . --`:

```bash
devcontainer exec --workspace-folder . -- python evals/runner.py
devcontainer exec --workspace-folder . -- pytest tests/ -q
devcontainer exec --workspace-folder . -- python -m ruff check agents/ evals/ tests/
```

> **Never use `docker exec devcontainer-devcontainer-1 ...`** — that relies on
> a hardcoded container name that may differ across environments.  Use
> `devcontainer exec --workspace-folder .` instead; it resolves the correct
> container automatically via the DevContainers spec.

> **Troubleshooting: devcontainer build fails**
> If `devcontainer up` or `devcontainer build` exits with an error mentioning a
> **feature** (e.g. `github-cli`), the feature install script failed in
> this sandbox.  Remove the offending feature from
> `.devcontainer/devcontainer.json`, rebuild, and open a follow-up issue so the
> root cause can be addressed in `copilot-setup-steps.yml`.
>
> **Node.js** is installed via `nvm` in `postCreateCommand` (not as a build-time
> feature) because the `node:1` devcontainer feature uses `nvm ls-remote` during
> the Docker build phase, which fails when the TLS proxy CA cert is not yet
> trusted.  At container runtime the proxy CA is accessible (via
> `sudo chmod o+rx /etc/ssl/certs` in `postCreateCommand`), so `nvm install --lts`
> succeeds and the full toolchain — Python 3.13, Node LTS, npm, gh, Copilot CLI
> — is available inside the container.

If Ollama is unreachable (no network access to registry.ollama.ai) set
`GITHUB_COPILOT_API_TOKEN` in the host environment; the runner will
auto-detect it and use the Copilot API instead.
The Copilot API is reachable from inside the DevContainer because
`docker-compose.yml` forwards `GITHUB_COPILOT_API_TOKEN` and sets `SSL_CERT_FILE` to the
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

If you are **inside the DevContainer**, run directly:

```bash
# Auto-detect provider (copilot if GITHUB_COPILOT_API_TOKEN is set, else ollama)
python evals/runner.py

# Force a specific provider
python evals/runner.py --provider copilot
python evals/runner.py --provider ollama --model gemma4:e2b

# Write a score file and update the baseline
python evals/runner.py --score-file /tmp/score.json --update-baseline
```

If you are **outside the DevContainer**, prefix each command with
`devcontainer exec --workspace-folder . --`:

```bash
devcontainer up --workspace-folder .

devcontainer exec --workspace-folder . -- python evals/runner.py
devcontainer exec --workspace-folder . -- python evals/runner.py --provider copilot
devcontainer exec --workspace-folder . -- python evals/runner.py --provider ollama --model gemma4:e2b
devcontainer exec --workspace-folder . -- python evals/runner.py --score-file /tmp/score.json --update-baseline
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

## Never assume software is installed

Before using any CLI tool, binary, or external service in a script or workflow,
verify it is available in the target environment. Do not assume that because a
tool is common it is present.

- **Check availability explicitly.** Use `command -v <tool>` in shell scripts
  and branch on the result. Emit a clear warning or error if the tool is absent.
- **Prefer environment-provided services over host-installed binaries.**
  For example, use the Ollama HTTP API (`OLLAMA_BASE_URL`) rather than
  the `ollama` CLI; use `curl` (universally available in the devcontainer) rather
  than language-specific HTTP clients when reaching a sidecar.
- **Document the requirement.** If a script genuinely requires a tool, state so
  at the top of the file and fail fast with a descriptive message rather than
  producing a silent or confusing error later.
- **Test the absent-tool path.** When writing the availability guard, verify the
  fallback (warning or skip) behaves correctly, not just the happy path.

## Design principles

When integrating with an external provider or library, identify the constructs
that are both available and recommended by that library using the tools at your
disposal (context7, documentation search).  Prefer patterns that allow future
extensibility without requiring changes to the core agent.

When adding a new capability that already has a parallel implementation (e.g. a
second runner), extract the shared logic first so each new variant only has to
supply what is genuinely different.

## Using any tool, action, CLI, or API

**Before writing or editing any usage of a tool, action, CLI flag, or API —
regardless of how well you think you know it — always look it up first.**
Familiarity is not a substitute for verification; most mistakes happen precisely
because the agent assumed it already knew the correct behaviour.

Follow this process every time, without exception:

1. **Find authoritative sources.** In order of preference:
   - Official documentation (linked from the repo, README, or action metadata)
   - `--help` / `man` output for CLI tools
   - Context7 (`context7-resolve-library-id` → `context7-query-docs`)
   - GitHub source / release notes for the specific version in use
2. **Derive the correct usage from what the sources say** — not from memory or
   analogy.  Quote or cite the relevant passage so the reasoning is traceable.
3. **Apply** the result consistently across every place the same pattern
   appears.  Do not fix one call site while leaving others broken.
4. **Validate** — run the relevant tests, linter, or CI job to confirm the
   result works before marking the task done.

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

1. Detected your environment (`echo ${DEVCONTAINER:-outside}`) and run the
   relevant command inside the DevContainer — directly if already inside, or
   via `devcontainer exec --workspace-folder . --` if outside.
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
