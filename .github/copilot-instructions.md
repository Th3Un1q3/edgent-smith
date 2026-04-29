tool is common it is present.
disposal (context7, documentation search).  Prefer patterns that allow future
# Copilot Instructions – edgent-smith

This repository implements a minimal, edge-optimised agentic system.

## Default operating mode
Make the minimal change that satisfies the request.

- Do not redesign architecture unless absolutely required.
- Prefer existing repo mechanisms and documented features over new solutions.
- Prefer small, local fixes over refactors.
- Escalate only when simpler options are proven unavailable.

Preference order (strict):
1. Adjust existing configuration
2. Use existing feature or repo pattern
3. Make a small local code change
4. Add files or abstractions
5. Redesign architecture

If blocked: report the blocker, what you verified, and the exact action requested from the user.

## Three-agent architecture

| Agent | File | Role |
|---|---|---|
| Edge Agent | `agents/edge.py` | pydantic-ai agent; inline tools; executes core logic and orchestrates workflow |
| Brainstorm Agent | `.github/agents/brainstorm.agent.md` | Copilot custom agent; generates ideas; creates `auto-research` issues |
| Implementation Agent | `.github/agents/implement.agent.md` | Copilot custom agent; applies experiment changes to `agents/edge.py` |

## Read only what you need
Only read the parts necessary for the task.

- Docs, comments, prompt text, or instruction-only edits: this file is sufficient.
- Localized code changes: read the target module and the Validation checklist.
- Provider wiring, eval behavior, runtime setup, or DevContainer changes: read the corresponding sections before editing.

## Quick task sizing

Match the amount of process to the size of the change.

### Scope 0: trivial

Examples: docs, comments, wording, prompt text, instruction files, typo fixes, formatting-only changes.

- DO: Edit directly.
- DO NOT: run runtime validation unless explicitly requested.

### Scope 1: localized

Examples: a small config change, a single-file logic fix, a narrow test update, a small DevContainer tweak using an existing mechanism.

- DO: Run the smallest relevant validation first (focused tests or a focused lint).
- DO NOT: run broader validation unless the change affects behavior outside the local area.

### Scope 2: behavioral or cross-cutting

Examples: provider parameter mapping, agent behavior changes, eval logic changes, runtime changes affecting multiple paths, new tools, new workflows.

- DO: Run the full validation checklist below.
- DO NOT: skip docs, audits, or required validations for cross-cutting changes.

If a task spans multiple scopes, use the highest relevant scope.

## Validation checklist

### Scope 1 validation

- DO: Run the smallest relevant validations first:
  - Unit tests: `just test`
  - Lint: `just lint`
  - Type checks: `just typecheck`
  - Formatting fixes (if needed): `just format`
- DO NOT: run broad evals or CI suites (`just eval`, `just eval-ci`) unless the change affects runtime behavior.
- Add or update tests only if behavior changed and existing coverage is insufficient.

### Scope 2 validation

#### Functional checks

- Run targeted tests first when they exist, then the full test suite if the change is behavioral or cross-cutting: `just test`.
- Run CLI or integration smoke checks only for the paths the change affects.
- If agent or eval behavior changed, run the relevant eval flow and compare the result with the existing baseline before updating anything.

- DO: For full validation run the following as appropriate:
  - `just test` (unit test suite)
  - `just lint` (static lint checks)
  - `just typecheck` (static types)
  - `just format` (format/auto-fix where supported)
  - `just fix` (attempt automatic fixes via scripts)
  - Eval runs: `just eval` (baseline), `just eval-local` (local debug), `just eval-ci` (CI smoke suite)
  - Compare candidate vs baseline: `just baseline-status "<id>"`

Examples:

```bash
# Exercise the edge agent prompt path when agent behavior changed
just edge-agent "What is 2+2?"

# Run the smoke eval runner when eval or provider behavior changed
just eval "edge_agent_default"
```

#### Non-functional checks

- Run linters on changed paths first; run broader lint only when the change crosses module boundaries.
- Prefer built-in generics and `X | None` annotations for Python 3.13.
- **Reliable Testing**: Ensure unit tests are environment-agnostic. Use `pytest` fixtures (like `monkeypatch`) to isolate and explicitly set all relevant environment variables, preventing leaks from the host or CI environment.
- Add unit tests for provider mapping logic only when provider mapping logic changed.
- Verify safety caps only when output-limit behavior changed.
- Check that secrets are not printed only when touching auth, logging, or provider parameter handling.

#### Documentation and governance

Update only what matches the change:

- Update `.env.example` for new or changed env vars.
- Update `README.md` or `docs/` for user-visible behavior, setup, or workflow changes.
- Add a masked audit line to `logs/model_params_audit.log` only when provider parameters or security-sensitive behavior changed.
- Add or update tests whenever behavior changed in a way that is not already covered.

#### CI expectations

Add CI enforcement only when the current change introduces a new behavior that can realistically regress and is worth checking automatically. Do not expand scope into CI work for unrelated cleanup.

## Verify that your work actually runs

Scale verification to the task.

- Scope 0: no runtime verification required.
- Scope 1: run the smallest relevant command inside the DevContainer when Python is involved.
- Scope 2: run the full relevant validation flow and confirm the output makes sense.

Keep all created or modified artifacts inside the repository unless the task explicitly requires external output.

## DevContainer and dependency changes

When the task involves installing or changing tools in the DevContainer, keep the solution narrow.

1. Inspect the existing `.devcontainer` configuration first.
2. Prefer an official Dev Container Feature over a custom Dockerfile, manual install script, or Compose redesign.
3. Check the authoritative feature docs or catalog before changing the install method.
4. Reuse the existing repo pattern when it already solves the problem.
5. Use explicit, reproducible versions when the repo already pins versions or when a floating version would make rebuilds unstable.
6. Treat unrelated container startup failures as separate issues. Confirm whether they predate your change before editing features, Dockerfiles, or Compose.
7. After making the smallest change, rebuild or test that specific path before escalating.
8. Only switch to a custom Dockerfile or broader redesign if no official feature or existing mechanism can satisfy the request, or if you verified that the simpler path fails for a documented reason.

Example: if the user asks to install Copilot CLI in the DevContainer, first inspect the existing feature list and official Dev Container Features. If an official feature exists, add or adjust that feature and test it. Do not remove unrelated features or start authoring a custom Dockerfile unless the feature path is unavailable or proven broken.

## Tool and dependency assumptions

When adding a CLI, binary, or external service to repo scripts, workflows, or the DevContainer, verify that it is available in the target environment. Do not add availability guards to ad-hoc terminal exploration unless the task needs them.

- Use `command -v <tool>` in shell scripts when tool presence is a real requirement.
- Prefer environment-provided services over host-installed binaries when both are available.
- If a script genuinely requires a tool, fail fast with a clear message.
- Test the absent-tool path only when you introduced such a guard.
- Prefer `uv run python` for repository Python execution when `uv` is installed, instead of manually sourcing a virtual environment.

## Execution environment — mandatory for Python commands

The sandbox host runs **Python 3.12**; this project requires **Python 3.13**.
The sandbox has **no Ollama daemon**.

All work in this repository should be executed inside the DevContainer. The supported command interface is the repo's `just` task runner. Use host-shell commands only when the DevContainer cannot be started or accessed for a technical reason.

The `docker-compose.yml` sets `DEVCONTAINER=true` inside the container, so you can detect the environment reliably:

```bash
if [ "${DEVCONTAINER:-}" = "true" ]; then
  echo "Inside DevContainer - run commands directly"
else
  echo "Outside DevContainer - prefix commands with: devcontainer exec --workspace-folder . --"
fi
```

### If you are inside the DevContainer

Run commands directly using the project environment with `just`.

```bash
just eval
just test
just lint
```

### If you are outside the DevContainer

If you must work from the host because the DevContainer cannot start, install the DevContainer CLI and start the container first:

```bash
command -v npm >/dev/null 2>&1 || { echo "npm not found — install Node.js 18+ first: https://nodejs.org"; exit 1; }
npm install -g @devcontainers/cli
devcontainer up --workspace-folder .
```

Then run repo tasks through `devcontainer exec --workspace-folder . -- just ...` so the actual work still executes inside the container:

```bash
devcontainer exec --workspace-folder . -- just eval
devcontainer exec --workspace-folder . -- just test
devcontainer exec --workspace-folder . -- just lint
```

Never use `docker exec devcontainer-devcontainer-1 ...`. Use `devcontainer exec --workspace-folder .` instead.

If Ollama is unreachable, set `GITHUB_COPILOT_API_TOKEN` in the host environment; the runner will auto-detect it and use the Copilot API instead.

## Eval runner architecture

`evals/runner.py` is the single entry point for all evals. It contains the model factories for both providers, the shared eval loop, and a `__main__` that auto-detects the provider from the environment.

| File | Role |
|------|------|
| `evals/runner.py` | Model factories, `run_eval()`, unified `__main__` |
| `evals/smoke.py` | Dataset, evaluators, and utilities |

The edge agent (`agents/edge.py`) is model-agnostic: it holds a plain string model and never references a provider. The runner selects and injects the model at call-time via `agent.run(prompt, model=model)`.

## Running evals

If you are inside the DevContainer, run directly:

```bash
just eval "edge_agent_default"
just eval-ci
just eval-local
```

If you are outside the DevContainer, prefix each command with `devcontainer exec --workspace-folder . --`.

## Scripts must be version-controlled

Do not leave repo scripts in `/tmp` or other ephemeral locations.

Any script you create for evaluations, experiments, or diagnostics should live in the repository:

| Purpose | Location |
|---------|----------|
| Eval runner variant | `evals/<name>.py` |
| One-off experiment helper | `experiments/<name>.py` |
| Build or CI helper | `scripts/<name>.sh` |

## Tool and dependency assumptions

When adding a CLI, binary, or external service to repo scripts, workflows, or the DevContainer, verify that it is available in the target environment. Do not add availability guards to ad-hoc terminal exploration unless the task needs them.

- Use `command -v <tool>` in shell scripts when tool presence is a real requirement.
- Prefer environment-provided services over host-installed binaries when both are available.
- If a script genuinely requires a tool, fail fast with a clear message.
- Test the absent-tool path only when you introduced such a guard.

## Design principles

When integrating with an external provider or library, identify the constructs that are both available and recommended by that library using the tools at your disposal.

- Prefer the smallest working integration.
- Minimal change first.
- Prefer an existing pattern in this repo over inventing a new abstraction.
- Extract shared logic when duplication is real and current, not speculative.
- Do not broaden a task into a general architecture cleanup unless the user asked for that.

## Using tools, actions, CLIs, and APIs

Without checking the docs you make repeated mistakes, miss important features, and create brittle solutions. Always check the authoritative documentation for any tool, library, or API you use, even if you have used it before.

Use this order:

1. Official documentation linked from the repo or tool metadata.
2. `--help` or `man` output for CLI tools.
3. Context7 documentation on libraries.
4. GitHub source or release notes for version-specific behavior.

Apply what you learned to the change you are making. Do not turn a local fix into a repo-wide sweep unless the same bug is clearly present elsewhere and the scope still matches the user request.

Example: for `devcontainers/ci` env-passing, the docs state that step-level `env:` is not forwarded into the container shell and only variables listed under `with.env` are available inside `runCmd`. Follow that documented behavior exactly rather than inferring from general GitHub Actions patterns.

## Agent definitions

GitHub Copilot custom agents live in `.github/agents/*.agent.md`.
They are invoked by the `auto-research` workflow via the GitHub Copilot CLI.

## Prompts

General prompts live in `.github/prompts/*.prompt.md`.

## Python runtime

Target Python 3.13. The codebase uses `from __future__ import annotations` for forward-reference compatibility; keep this import in all Python files.
