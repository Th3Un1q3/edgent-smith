# Architecture

## System overview

edgent-smith is a modular agentic platform structured around four concerns:

1. **Production service** – a FastAPI REST API that accepts prompts and returns agent responses
2. **Agent layer** – PydanticAI agents with edge-optimised configuration
3. **Evaluation harness** – an immutable judge that scores agent quality and resource behavior
4. **Experiment framework** – tooling and rules for Copilot-driven evolutionary improvement

---

## Component boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                      REST API (FastAPI)                     │
│   /api/v1/tasks   /healthz   /readyz   /metrics             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Job Executor (orchestration)                 │
│   sync / async job queue, lifecycle management              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  EdgeAgent (PydanticAI)                     │
│   system prompt · tools · deps · output schema              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Model Provider (abstraction layer)             │
│   OllamaProvider  │  (future: OpenAI, Anthropic, …)        │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   Ollama (local)    │
              │   gemma3:4b (default)│
              └─────────────────────┘
```

---

## Provider abstraction

All model access goes through `ModelProviderBase` (`src/edgent_smith/providers/base.py`).

- `get_pydantic_ai_model()` returns a pydantic-ai–compatible model identifier.
- `health_check()` returns `True` if the provider is reachable.
- `get_provider(settings)` in `providers/registry.py` resolves the configured provider at runtime.

To add a new provider:
1. Create `src/edgent_smith/providers/my_provider.py` implementing `ModelProviderBase`.
2. Add the new value to `ModelProvider` enum in `settings.py`.
3. Add a `case` in `registry.py`.

---

## Edge-model design constraints

All architectural decisions in this codebase apply the following edge constraints:

| Constraint | Mechanism |
|---|---|
| Short prompts | System prompt enforces brevity; `max_tokens` budget |
| Bounded context | `AgentDeps.max_tokens` passed to every run |
| Tool discipline | System prompt instructs tool-use only when necessary |
| Low verbosity | `confidence: abstain` path for uncertain answers |
| Token budget | `max_tokens` setting (default 512), enforced via provider |
| Timeouts | `timeout_seconds` setting (default 30s) |
| Retries | `max_retries` setting (default 3) with tenacity |
| Max tool calls | `max_tool_calls` setting (default 5) |

---

## Experiment architecture

```
experiments/
├── ledger.json              ← append-only log of all experiments
├── manifests/               ← one JSON per experiment (init → eval → decision)
├── baselines/               ← current champion snapshot
│   └── current.json
├── results/                 ← eval suite output (auto-generated)
└── scripts/
    ├── init_experiment.py   ← create manifest, validate mutation surfaces
    ├── register_baseline.py ← run eval, save as baseline
    ├── run_candidate.py     ← run eval suites against candidate
    ├── compare.py           ← compare candidate vs baseline, emit decision
    └── promote.py           ← update baseline, generate PR description
```

### Immutable judge vs mutable surfaces

```
IMMUTABLE (do not change during experiments):
  eval/harness.py
  eval/suites/smoke.py
  eval/suites/benchmark.py
  eval/suites/holdout.py
  experiments/scripts/compare.py  (thresholds)

MUTABLE (allowed experiment surfaces):
  prompts/system/edge_agent.md
  src/edgent_smith/agents/edge_agent.py  (system prompt, agent config)
  src/edgent_smith/config/settings.py   (defaults only)
  src/edgent_smith/tools/               (tool descriptions, logic)
```

See `EXPERIMENT_RULES.md` for the full surface definition.

---

## Directory layout

```
edgent-smith/
├── src/edgent_smith/
│   ├── config/          typed settings (pydantic-settings)
│   ├── providers/       model provider abstraction + Ollama adapter
│   ├── agents/          PydanticAI agent definitions
│   ├── tools/           tool registry and built-in tools
│   ├── api/             FastAPI routes and schemas
│   │   └── v1/          versioned endpoints
│   ├── orchestration/   job executor
│   └── main.py          app factory + CLI entry point
├── eval/                immutable evaluation harness
│   └── suites/          smoke / benchmark / holdout case lists
├── experiments/         experiment orchestration
│   └── scripts/         CLI scripts for the experiment loop
├── prompts/system/      system prompts used by the agentic service
├── PROMPTS/             reusable prompts for Copilot / Copilot CLI
├── tests/
│   ├── unit/
│   ├── integration/
│   └── eval/
├── .devcontainer/       Dev Container definition with Ollama sidecar
├── .github/workflows/   CI pipelines
└── docs/                focused documentation
```
