# edgent-smith

Minimal agentic system optimised for edge models (Gemma/Ollama).  
Three agents · pydantic-ai evaluations · DevContainer-first CI · issue-driven experiment loop.

---

## Repository layout

```
agents/
  edge.py                      # Edge agent – single file, inline tools, pydantic-ai
evals/
  runner.py                    # Unified eval runner (Ollama + Copilot, auto-detected)
  smoke.py                     # Smoke eval dataset + utilities (pydantic_evals)
  *.baseline.json              # Per-model minimum score threshold for experiment promotion
tests/
  test_edge_agent.py
.devcontainer/                 # Python 3.13 + Ollama sidecar
.github/
  agents/
    edge-architect.agent.md    # Copilot custom agent – designs experiments and replenishes queue
    implement.agent.md         # Copilot custom agent – implements experiments
  prompts/                     # *.prompt.md – general agent prompts
  workflows/
    ci.yml                     # Lint + type-check + tests (DevContainer)
    experiment.yml             # Issue-driven auto-research workflow (DevContainer)
```

---

## Three-agent workflow

```
Copilot Edge Architect Agent  (.github/agents/edge-architect.agent.md)
  └─ designs experiments → creates GitHub issues labelled "auto-research"
        │
        ▼  (issues.labeled trigger)
  experiment.yml workflow  ← runs inside DevContainer
        │
        ├─ invokes GitHub Copilot CLI (@github/copilot, model: gpt-5)
        │   with .github/agents/implement.agent.md as instructions
        │   Copilot edits agents/edge.py directly with its file tools
        │
        ├─ runs pydantic_evals smoke suite → score
        │
        ├─ candidate improves baseline and promotion succeeds
        │   └─ promote baseline + commit + push + comment ✅ on issue
        │
        └─ candidate does not improve baseline or later workflow side effects fail
            └─ comment ❌ on issue with details
```

---

## Triggering an experiment

1. Create a GitHub issue describing the experiment hypothesis.
2. Add the **`auto-research`** label.
3. The workflow fires automatically inside the DevContainer.
4. Monitor the issue for a ✅ or ❌ comment.

### Required repository secret

The auto-research workflow uses the real **GitHub Copilot CLI** (`@github/copilot`)
with the `gpt-5` model. It requires one secret set in
**Settings → Secrets and variables → Actions**:

| Secret | How to create |
|--------|---------------|
| `COPILOT_GITHUB_TOKEN` | Create a fine-grained PAT at [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new). Under **Permissions → Account permissions** add **Copilot Requests (read)**. |

---

## Baseline score

The minimum assertion pass-rate is stored per-baseline ID in `../{baseline_id}.baseline.json`.  
The runner reads the current baseline from that file if present and writes a candidate result to
`../{baseline_id}.baseline-candidate.json` for later promotion or review.

For the reusable experiment workflow, baseline handling is split intentionally:

- If the requested baseline file does not exist yet, `scripts/experiment.py` bootstraps it before the first Copilot edit by running the eval lane once and promoting that candidate into the baseline file.
- After a normal experiment run produces a better candidate, the GitHub workflow owns the promotion step, labels/comments on the issue, and the final commit/push on `auto_research`.

The experiment runner also keeps durable per-issue state in `experiments/<issue_number>.state.json`.
That state tracks attempt history, the deterministic Copilot session name, whether bootstrap happened,
and minimal workflow handoff data. Workflow-owned side effects are persisted separately in the same file
as `promotion_applied`, `commit_pushed`, `status_comment_id`, and `replenishment_issue_number`.
When the auto-research queue becomes empty after terminalization, the workflow may also draft and create
exactly one replacement `auto-research` issue through the edge-architect agent.

For local or manual runs, the public entrypoint is:

```bash
just run-experiment "Please read experiments/123.md for the full issue body. Perform described experiment end to end."
```

Additional flags are forwarded to `scripts/experiment.py`, for example:

```bash
just run-experiment "Dry-run probe" --dry --baseline-id auto_research --issue-number 123
```

For the local foreground loop, prefer:

```bash
just run-experiment-loop \
  --hooks local \
  --engineer-model gpt-5-mini \
  --eval-model edge_agent_local_openrouter \
  --baseline-id local_openrouter
```

`--model-alias` and `--model` remain compatibility aliases for the engineer model option.

`just experiment-loop` remains a compatibility alias for the same command.

`--hooks <set>` resolves hook scripts under `hooks/<set>/`. With `--hooks local`, the loop uses the two example local hooks when present:

- `experiment_generated.sh` initializes `experiments/local_idea_draft.yaml` with a placeholder local idea when no draft/title/body inputs exist yet.
- `experiment_complete.sh` appends a per-iteration result summary to `experiments/local_loop_history.log` after each iteration.

Loop stop behavior is intentionally foreground and minimal:

- `--max-experiments` and `--max-minutes` are soft stops. The loop finishes the current iteration, then exits.
- Manual interruption remains immediate because the loop runs in the foreground.

Baseline handling remains strict:

- Promotion is strict-improvement-only.
- `just baseline-status <baseline-id>` is diagnostic only and does not promote anything.

Inside the DevContainer:

```bash
just eval "edge_agent_default"
```

Outside the DevContainer:

```bash
devcontainer exec --workspace-folder . -- just eval "edge_agent_default"
```

---

## Quick start (DevContainer)

### If you are already INSIDE the DevContainer (VS Code "Reopen in Container")

```bash
# Pull a model (Ollama is on the Docker network at the service name, not localhost)
curl -s "${OLLAMA_BASE_URL:-http://ollama:11434}/api/pull" \
  -d '{"model":"gemma4:e2b"}' | grep -E '"status"|"error"'

# Run the edge agent
just edge-agent "What is the capital of France?"

# Run smoke evals (auto-detects Ollama or Copilot provider)
just eval

# Use a named model from the registry
just eval "edge_agent_default"
EDGENT_NAMED_MODEL=edge_agent_fast just eval "edge_agent_fast"

# Run tests  (uses TestModel – no Ollama needed)
just test

# Run the autofix workflow
just fix
```

`just edge-agent` now runs the existing `edge_agent_local_openrouter` alias and prints local Jaeger trace lookup details alongside the agent response. Open `http://localhost:16686` to inspect the full span tree after a run.

## Autofix workflow

`just fix` now routes directly to the Python CLI implementation:

```bash
uv run python -m cli autoresearch fix
```

Pass `--continue` to reuse the prior Copilot session for the first remediation turn:

```bash
just fix --continue
```

Pass `--parallel` to run the first pass for all configured hooks concurrently, batch every first-pass failure into a single Copilot remediation turn, then rerun only the hooks that initially failed:

```bash
just fix --parallel
```

Without `--parallel`, the CLI runs the hooks defined in `autofix.toml` in file order. With `--parallel`, the first pass starts every configured hook concurrently, then any first-pass failures are collated and retried in config order. The shipped config includes the default `just format`, `just lint`, `just typecheck`, `just test`, and workflow-security checks, and you can add or reorder hooks by editing the file:

```toml
[[hooks]]
name = "tests"
command = "just test"
remediation_prompt = "Tests failed with this error: ${hook_stdout}. Find the most non breaking way to fix the test. To re-run test use just test"
```

Each hook needs a `name`, a shell `command`, and a `remediation_prompt`. The prompt supports placeholders including `${hook_name}`, `${hook_command}`, `${hook_stdout}`, `${hook_stderr}`, and `${hook_output}`.

### Starting the DevContainer from the CLI (no VS Code)

If you are in a headless environment (e.g. a CI sandbox or Copilot agent
workspace), start the DevContainer with the
[DevContainer CLI](https://github.com/devcontainers/cli):

```bash
# Install the CLI (Node 18+)
npm install -g @devcontainers/cli

# Build and start (Python 3.13 + Ollama sidecar)
# GITHUB_COPILOT_API_TOKEN and COPILOT_GITHUB_TOKEN are forwarded automatically
# when set in the host env (see docker-compose.yml)
devcontainer up --workspace-folder .

# Install the package inside the running container
devcontainer exec --workspace-folder . -- uv pip install -e . --group dev

# Run tests
devcontainer exec --workspace-folder . -- just test

# Run smoke evals (auto-detects provider from GITHUB_COPILOT_API_TOKEN)
devcontainer exec --workspace-folder . -- just eval

devcontainer exec --workspace-folder . -- just eval "edge_agent_default"

devcontainer exec --workspace-folder . -- just eval "edge_agent_fast"
```

> **Note:** The `docker-compose.yml` sets `DEVCONTAINER=true` inside the
> container.  Scripts and agents can detect their environment with:
> ```bash
> if [ "${DEVCONTAINER:-}" = "true" ]; then
>   echo "inside - run directly"
> else
>   echo "outside - prefix with: devcontainer exec --workspace-folder . --"
> fi
> ```

---

## Running evals without Ollama (Copilot API fallback)

The Ollama registry (`registry.ollama.ai`) is blocked in some sandbox
environments. The unified runner auto-detects the right provider:

- **Copilot** is used when `GITHUB_COPILOT_API_TOKEN` is set in the environment.
- **Ollama** is used otherwise.

For the local eval lane only, `just eval-local` uses the OpenRouter-backed
`edge_agent_local_openrouter` model and writes results under the
`local_openrouter` baseline lane. That path requires `OPENROUTER_API_KEY`.
Generic eval behavior, including `just eval` and `edge_agent_default`, is
otherwise unchanged.

`docker-compose.yml` already forwards `GITHUB_COPILOT_API_TOKEN` and `COPILOT_GITHUB_TOKEN`, and sets
`SSL_CERT_FILE` to the system CA bundle, so the Copilot API is reachable from
inside the DevContainer with no extra configuration.

For interactive validation, `just edge-agent` also bootstraps Pydantic AI's official Logfire instrumentation in local-only mode with `logfire.configure(send_to_logfire=False)` and exports OTLP traces to the Jaeger sidecar at `http://jaeger:4318`.

Inside the DevContainer:

```bash
# Auto-detect provider
just eval

# Write a baseline candidate file for later promotion or review
just eval "edge_agent_default"
```

Outside the DevContainer:

```bash
# Start the DevContainer (token is forwarded automatically)
devcontainer up --workspace-folder .

# Auto-detect provider
devcontainer exec --workspace-folder . -- just eval

# Write a baseline candidate file for later promotion or review
devcontainer exec --workspace-folder . -- just eval --baseline-id edge_agent_default
```

The runner exercises the **same** smoke dataset and the **same** edge agent regardless
of provider. The only difference is the model backend.

---

## Local install (without DevContainer)

Requires Python 3.13. If `uv` is installed, prefer `uv run python ...` for Python execution instead of manually activating the virtual environment.

```bash
uv pip install -e . --group dev
just test
just lint
```

---

## CI

CI runs inside the DevContainer via `devcontainers/ci@v0.3`.  
No separate Python environment is provisioned.

---

## Model presets and configuration

This repository now centralises model configuration in `config.py` and supports named presets and per-run overrides.

- `EDGENT_PRESET`: Optional env var or `--preset` CLI flag to select a named preset (for example `fast` or `reasoned`).
- `EDGENT_OVERRIDES`: Optional JSON string merged with the selected preset. Example: `'{"max_tokens":256,"think":false}'`.
- `HARD_MAX_OUTPUT_TOKENS`: Safety cap preventing presets or overrides from requesting excessive output tokens (default `2000`).

Usage examples:

```bash
# Run the smoke evals using a named preset (via env var)
EDGENT_PRESET=reasoned just eval

# Or set via environment
EDGENT_PRESET=fast just eval

# Provide fine-grained overrides
EDGENT_OVERRIDES='{"max_tokens":256,"think":false}' just eval

# Use a specific baseline ID
just eval "edge_agent_default"
```

Behavior and safety:
- Presets are merged with any JSON overrides; explicit CLI arguments take precedence.
- All numeric params are validated and normalized (e.g. `temperature` range, `top_p`, `max_tokens`).
- Thinking traces (`think`) are opt-in only; defaults avoid enabling chain-of-thought by default.
- Secrets (API tokens) are never logged and are masked in printed config values.

See `config.py` for the canonical preset definitions and `docs/models.md` for a short per-model capability matrix.

