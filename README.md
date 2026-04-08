# edgent-smith

Minimal agentic system optimised for edge models (Gemma/Ollama).  
Three agents · pydantic-ai evaluations · DevContainer-first CI · issue-driven experiment loop.

---

## Repository layout

```
agents/
  edge.py                      # Edge agent – single file, inline tools, pydantic-ai
evals/
  smoke.py                     # Smoke eval dataset (pydantic_evals)
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
        ├─ invokes Copilot implement agent (.github/agents/implement.agent.md)
        │   via GitHub Copilot CLI (gh copilot suggest)
        │   └─ applies minimal changes to agents/edge.py
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

Or brainstorm ideas via the Brainstorm agent:
```bash
# Read the agent instructions
cat .github/agents/brainstorm.agent.md
# Then invoke via gh copilot
gh copilot suggest -t shell "$(cat .github/agents/brainstorm.agent.md)"
```

---

## Baseline score

The minimum assertion pass-rate is defined in `evals/baseline.json` (default: **0.80**).  
Update both `evals/baseline.json` and `BASELINE_SCORE` in `evals/smoke.py` together.

---

## Quick start (DevContainer)

```bash
# Open in VS Code → "Reopen in Container"
# Pull a model
docker exec -it $(docker ps --filter name=ollama --format '{{.Names}}' | head -1) ollama pull gemma3:4b

# Run the edge agent
python agents/edge.py "What is the capital of France?"

# Run smoke evals  (requires a running Ollama instance)
python evals/smoke.py

# Run tests  (uses TestModel – no Ollama needed)
pytest tests/ -q
```

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
