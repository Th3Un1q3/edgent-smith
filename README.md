# edgent-smith

Minimal agentic system optimised for edge models (Gemma/Ollama).  
Three agents · pydantic-ai evaluations · DevContainer-first CI · issue-driven experiment loop.

---

## Repository layout

```
agents/
  edge.py         # Edge agent – single file, inline tools, pydantic-ai
  brainstorm.py   # Copilot Brainstorm Agent (creates GitHub experiment issues)
  implement.py    # Copilot Implementation Agent (runs experiments from issues)
evals/
  smoke.py        # Smoke eval dataset (pydantic_evals, no custom wrapper)
tests/
  test_edge_agent.py
.devcontainer/    # Python 3.13 + Ollama sidecar
.github/
  prompts/        # *.prompt.md – agent and workflow prompts
  workflows/
    ci.yml        # Lint + type-check + tests (runs inside DevContainer)
    experiment.yml # Issue-driven experiment workflow (DevContainer + Copilot CLI)
```

---

## Three-agent workflow

```
Copilot Brainstorm Agent
  └─ generates ideas → creates GitHub issues labelled "experiment"
        │
        ▼  (issues.labeled trigger)
  experiment.yml workflow  ← runs inside DevContainer
        │
        ▼
  Copilot Implementation Agent  (agents/implement.py)
        ├─ applies changes on a new branch
        ├─ runs tests + lint
        ├─ SUCCESS → opens PR, comments ✅ on issue
        └─ FAILURE → comments ❌ on issue
              │
              ▼  (issue_comment.created trigger)
        Edge Agent  (agents/edge.py)
              └─ reacts to comment, continues orchestration
```

---

## Quick start (DevContainer)

```bash
# Open in VS Code → "Reopen in Container"
# Pull a model
docker exec -it <ollama> ollama pull gemma3:4b

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

## Trigger an experiment manually

1. Create a GitHub issue labelled `experiment` describing the hypothesis.
2. The `experiment.yml` workflow fires automatically.
3. Monitor the issue for a ✅ or ❌ comment from the Implementation Agent.

Or brainstorm ideas programmatically:

```bash
python agents/brainstorm.py --count 3
```

---

## Configuration

Set `EDGENT_MODEL` to override the default model:

```bash
EDGENT_MODEL=ollama:llama3:8b python agents/edge.py "Hello"
```

---

## CI

CI runs inside the DevContainer via `devcontainers/ci@v0.3`.  
No separate Python environment is provisioned.
