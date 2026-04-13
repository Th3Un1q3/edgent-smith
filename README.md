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

The minimum assertion pass-rate is stored per-model in `evals/<model>.baseline.json`.  
It is updated automatically by the experiment workflow when a new score exceeds the current value,
or you can update it manually.

Inside the DevContainer:

```bash
python evals/runner.py --update-baseline
```

Outside the DevContainer:

```bash
devcontainer exec --workspace-folder . -- python evals/runner.py --update-baseline
```

---

## Quick start (DevContainer)

### If you are already INSIDE the DevContainer (VS Code "Reopen in Container")

```bash
# Pull a model
curl -s http://localhost:11434/api/pull -d '{"model":"gemma4:e2b"}' | grep -E '"status"|"error"'

# Run the edge agent
python agents/edge.py "What is the capital of France?"

# Run smoke evals (auto-detects Ollama or Copilot provider)
python evals/runner.py

# Run tests  (uses TestModel – no Ollama needed)
pytest tests/ -q
```

### Starting the DevContainer from the CLI (no VS Code)

If you are in a headless environment (e.g. a CI sandbox or Copilot agent
workspace), start the DevContainer with the
[DevContainer CLI](https://github.com/devcontainers/cli):

```bash
# Install the CLI (Node 18+)
npm install -g @devcontainers/cli

# Build and start (Python 3.13 + Ollama sidecar)
# GITHUB_COPILOT_API_TOKEN is forwarded automatically when set in the host env
devcontainer up --workspace-folder .

# Install the package inside the running container
devcontainer exec --workspace-folder . -- pip install -e '.[dev]'

# Run tests
devcontainer exec --workspace-folder . -- pytest tests/ -q

# Run smoke evals (auto-detects provider from GITHUB_COPILOT_API_TOKEN)
devcontainer exec --workspace-folder . -- python evals/runner.py

# Force a specific provider
devcontainer exec --workspace-folder . -- python evals/runner.py --provider ollama --model gemma4:e2b
devcontainer exec --workspace-folder . -- python evals/runner.py --provider copilot
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

`docker-compose.yml` already forwards `GITHUB_COPILOT_API_TOKEN` and sets
`SSL_CERT_FILE` to the system CA bundle, so the Copilot API is reachable from
inside the DevContainer with no extra configuration.

Inside the DevContainer:

```bash
# Auto-detect provider
python evals/runner.py

# Write a CI-compatible score file
python evals/runner.py --score-file /tmp/score.json

# Update the baseline when the new score beats the current one
python evals/runner.py --update-baseline
```

Outside the DevContainer:

```bash
# Start the DevContainer (token is forwarded automatically)
devcontainer up --workspace-folder .

# Auto-detect provider
devcontainer exec --workspace-folder . -- python evals/runner.py

# Write a CI-compatible score file
devcontainer exec --workspace-folder . -- python evals/runner.py --score-file /tmp/score.json

# Update the baseline when the new score beats the current one
devcontainer exec --workspace-folder . -- python evals/runner.py --update-baseline
```

The runner exercises the **same** smoke dataset and the **same** edge agent regardless
of provider. The only difference is the model backend.

---

## Local install (without DevContainer)

Requires Python 3.13.

```bash
pip install -e ".[dev]"
pytest tests/ -q
python -m ruff check agents/ evals/ tests/
```

---

## CI

CI runs inside the DevContainer via `devcontainers/ci@v0.3`.  
No separate Python environment is provisioned.

