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
    brainstorm.agent.md        # Copilot custom agent – generates experiment issues
    implement.agent.md         # Copilot custom agent – implements experiments
  prompts/                     # *.prompt.md – general agent prompts
  workflows/
    ci.yml                     # Lint + type-check + tests (DevContainer)
    experiment.yml             # Issue-driven auto-research workflow (DevContainer)
```

---

## Three-agent workflow

```
Copilot Brainstorm Agent  (.github/agents/brainstorm.agent.md)
  └─ generates ideas → creates GitHub issues labelled "auto-research"
        │
        ▼  (issues.labeled trigger)
  experiment.yml workflow  ← runs inside DevContainer
        │
        ├─ invokes GitHub Copilot CLI (@github/copilot, model: gpt-5-mini)
        │   with .github/agents/implement.agent.md as instructions
        │   Copilot edits agents/edge.py directly with its file tools
        │
        ├─ runs pydantic_evals smoke suite → score
        │
        ├─ score >= baseline
        │   └─ commit + push + open PR + comment ✅ on issue
        │
        └─ score < baseline
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
with the `gpt-5-mini` model. It requires one secret set in
**Settings → Secrets and variables → Actions**:

| Secret | How to create |
|--------|---------------|
| `COPILOT_GITHUB_TOKEN` | Create a fine-grained PAT at [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new). Under **Permissions → Account permissions** add **Copilot Requests (read)**. |

---

## Baseline score

The minimum assertion pass-rate is stored per-baseline ID in `../{baseline_id}.baseline.json`.  
The runner reads the current baseline from that file if present and writes a candidate result to
`../{baseline_id}.baseline-candidate.json` for later promotion or review.

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
```

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

`docker-compose.yml` already forwards `GITHUB_COPILOT_API_TOKEN` and `COPILOT_GITHUB_TOKEN`, and sets
`SSL_CERT_FILE` to the system CA bundle, so the Copilot API is reachable from
inside the DevContainer with no extra configuration.

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

Requires Python 3.13.

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

