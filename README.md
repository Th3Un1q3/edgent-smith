# edgent-smith

**Agentic system optimized for edge models.** A production-quality platform built on [PydanticAI](https://ai.pydantic.dev/) with Ollama-backed local inference, a REST API, an immutable evaluation harness, and a closed-loop experiment framework for GitHub Copilot-driven evolution.

---

## Quick start (devcontainer)

```bash
# Open in VS Code Dev Containers (recommended)
code .
# → "Reopen in Container" → services start (app + Ollama)

# Pull a model in the Ollama container
docker exec -it <ollama-container> ollama pull gemma3:4b
```

## Quick start (local)

```bash
# 1. Install
pip install -e ".[dev]"

# 2. Start Ollama separately and pull a model
ollama pull gemma3:4b

# 3. Configure
cp .env.example .env   # edit as needed

# 4. Run
edgent-smith
# → http://localhost:8000
```

## Run with Docker Compose

```bash
docker compose up --build
# Service: http://localhost:8000
# Ollama:  http://localhost:11434
```

---

## REST API

Base URL: `http://localhost:8000/api/v1`

| Endpoint | Method | Description |
|---|---|---|
| `/healthz` | GET | Health + provider status |
| `/readyz` | GET | Readiness probe |
| `/metrics` | GET | Job counters |
| `/tasks` | POST | Submit task (sync or async) |
| `/tasks/{job_id}` | GET | Poll async job |

**Submit a task (synchronous):**
```bash
curl -s -X POST http://localhost:8000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?", "async_execution": false}' | jq .
```

**Submit async + poll:**
```bash
JOB=$(curl -s -X POST http://localhost:8000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain quantum entanglement.", "async_execution": true}' \
  | jq -r .job_id)

curl -s http://localhost:8000/api/v1/tasks/$JOB | jq .
```

**OpenAPI docs:** `http://localhost:8000/docs`

---

## Run evals

```bash
# Register baseline (smoke suite)
python experiments/scripts/register_baseline.py --suite smoke

# Run smoke eval against current code
python experiments/scripts/run_candidate.py --name my-exp --suite smoke

# Compare against baseline
python experiments/scripts/compare.py --name my-exp --suite smoke
```

---

## Run an experiment

```bash
# 1. Initialize experiment manifest
python experiments/scripts/init_experiment.py \
  --name "shorter-system-prompt" \
  --hypothesis "Shorter prompt reduces latency without quality loss" \
  --mutation-surface "prompts/system/edge_agent.md"

# 2. Create branch
git checkout -b experiment/shorter-system-prompt

# 3. Mutate only the listed surface(s)

# 4. Run staged evaluation
python experiments/scripts/run_candidate.py --name shorter-system-prompt --suite smoke
python experiments/scripts/compare.py --name shorter-system-prompt --suite smoke
# If smoke passes → run benchmark → compare → holdout → compare

# 5. Promote if accepted
python experiments/scripts/promote.py --name shorter-system-prompt
```

See `EXPERIMENT_RULES.md` for the full rules.

---

## How Copilot/Copilot CLI should be used

This repository is designed for GitHub Copilot to act as a disciplined experiment executor:

1. Read `EXPERIMENT_RULES.md` before starting any experiment
2. Use `PROMPTS/propose_experiment.md` to form a hypothesis
3. Use `PROMPTS/implement_candidate.md` to make changes
4. Run evals and use `PROMPTS/analyze_results.md` to interpret them
5. Use `PROMPTS/promotion_pr.md` to prepare a PR if accepted

---

## Tests

```bash
pytest tests/ -q
```

## Configuration

All settings use the `EDGENT_` environment variable prefix. See `.env.example`.

| Variable | Default | Description |
|---|---|---|
| `EDGENT_MODEL_PROVIDER` | `ollama` | Provider: `ollama` |
| `EDGENT_MODEL_NAME` | `gemma3:4b` | Model identifier |
| `EDGENT_OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `EDGENT_MAX_TOKENS` | `512` | Output token budget |
| `EDGENT_TIMEOUT_SECONDS` | `30.0` | Per-request timeout |
| `EDGENT_MAX_TOOL_CALLS` | `5` | Max tool calls per run |
