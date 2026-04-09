# edgent-smith

Minimal agentic system optimised for edge models (Gemma/Ollama).  
Three agents · pydantic-ai evaluations · DevContainer-first CI · issue-driven experiment loop.

---

## Repository layout

```
agents/
  edge.py                      # Edge agent – single file, inline tools, pydantic-ai
evals/
  smoke.py                     # Smoke eval dataset + utilities (pydantic_evals)
  ollama_runner.py             # Eval runner using local Ollama (default backend)
  copilot_runner.py            # Eval runner using GitHub Copilot API (no Ollama needed)
  baseline.json                # Minimum score threshold for experiment promotion
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
        ├─ score >= baseline (evals/baseline.json)
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

The minimum assertion pass-rate is stored in `evals/baseline.json`.  
It is updated automatically: run `python evals/ollama_runner.py --update-baseline` inside the DevContainer and the file is overwritten whenever the new score exceeds the current value.

---

## Quick start (DevContainer)

```bash
# Open in VS Code → "Reopen in Container"
# Pull a model
docker exec -it $(docker ps --filter name=ollama --format '{{.Names}}' | head -1) ollama pull gemma4:e2b

# Run the edge agent
python agents/edge.py "What is the capital of France?"

# Run smoke evals  (requires a running Ollama instance)
python evals/ollama_runner.py

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
docker exec devcontainer-devcontainer-1 pip install -e '/workspace/.[dev]'

# Run tests
docker exec devcontainer-devcontainer-1 bash -c "cd /workspace && pytest tests/ -q"

# Run smoke evals (after pulling the model)
docker exec devcontainer-ollama-1 ollama pull gemma4:e2b
docker exec devcontainer-devcontainer-1 bash -c "cd /workspace && python evals/ollama_runner.py"
```

---

## Running evals without Ollama (Copilot API fallback)

The Ollama registry (`registry.ollama.ai`) is blocked in some sandbox
environments.  Use `evals/copilot_runner.py` as a drop-in replacement.

`docker-compose.yml` already forwards `GITHUB_COPILOT_API_TOKEN` and sets
`SSL_CERT_FILE` to the system CA bundle, so the Copilot API is reachable from
inside the DevContainer with no extra configuration.

```bash
# Start the DevContainer (token is forwarded automatically)
devcontainer up --workspace-folder .

# Run evals via the Copilot API (same agent, same dataset, different model backend)
docker exec devcontainer-devcontainer-1 \
  bash -c "cd /workspace && python evals/copilot_runner.py"

# Choose a different model
docker exec devcontainer-devcontainer-1 \
  bash -c "cd /workspace && python evals/copilot_runner.py --model gpt-4o-2024-11-20"

# Write a CI-compatible score file
docker exec devcontainer-devcontainer-1 \
  bash -c "cd /workspace && python evals/copilot_runner.py --score-file /tmp/score.json"

# Update baseline.json when the new score beats the current one
docker exec devcontainer-devcontainer-1 \
  bash -c "cd /workspace && python evals/copilot_runner.py --update-baseline"
```

`evals/copilot_runner.py` runs the same smoke dataset and the same edge agent
as `evals/ollama_runner.py`.  It overrides the agent's model to the Copilot API
per-run so the full agent (system prompt + all registered tools) is exercised.

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
