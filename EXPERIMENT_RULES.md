# Experiment Rules

These rules govern how GitHub Copilot and Copilot CLI operate in this repository.
**Read this file before starting any experiment.**

---

## 1. What Copilot may change (mutable surfaces)

Copilot is permitted to modify **only** the following files during an experiment:

| Surface | Notes |
|---|---|
| `prompts/system/edge_agent.md` | System prompt content |
| `src/edgent_smith/agents/edge_agent.py` | System prompt string, AgentDeps defaults |
| `src/edgent_smith/config/settings.py` | Default values only (not structure) |
| `src/edgent_smith/tools/*.py` | Tool descriptions, tool logic |

All other files are **off-limits** during experiment cycles.

---

## 2. What Copilot must never change

- `eval/harness.py` – immutable judge
- `eval/suites/*.py` – eval cases
- `experiments/scripts/compare.py` – thresholds are part of the judge
- `tests/` – test suite integrity
- `EXPERIMENT_RULES.md` – this file
- `pyproject.toml` – dependencies and build config
- `Dockerfile`, `docker-compose.yml` – deployment infrastructure

---

## 3. Mutation focus areas

Prefer mutations in this priority order:

1. **Prompt templates** – system prompt wording, structure, instructions
2. **Routing/orchestration logic** – how tasks are dispatched
3. **Tool descriptions** – what tools are called and when
4. **Output constraints** – token budget, confidence thresholds
5. **Decoding parameters** – temperature, top-p (via model settings)
6. **Retrieval parameters** – context window usage

Avoid mutations that:
- Add new dependencies
- Change the API contract
- Touch the eval harness
- Restructure the package layout

---

## 4. Branch naming convention

All experiment branches must follow:
```
experiment/<slug>
```
Example: `experiment/shorter-system-prompt`

---

## 5. Required workflow

Every experiment must follow these steps **in order**:

### Step 1 – Initialize
```bash
python experiments/scripts/init_experiment.py \
  --name <slug> \
  --hypothesis "<one sentence>" \
  --mutation-surface <file> [<file> ...]
```

### Step 2 – Baseline (if not registered)
```bash
python experiments/scripts/register_baseline.py --suite smoke
```

### Step 3 – Implement
Modify only the surfaces listed in the manifest.

### Step 4 – Smoke eval
```bash
python experiments/scripts/run_candidate.py --name <slug> --suite smoke
python experiments/scripts/compare.py --name <slug> --suite smoke
```
**Stop here and reject if smoke fails.**

### Step 5 – Benchmark eval
```bash
python experiments/scripts/run_candidate.py --name <slug> --suite benchmark
python experiments/scripts/compare.py --name <slug> --suite benchmark
```
**Stop here and reject if benchmark fails.**

### Step 6 – Holdout eval (promotion gate)
```bash
python experiments/scripts/run_candidate.py --name <slug> --suite holdout
python experiments/scripts/compare.py --name <slug> --suite holdout
```

### Step 7 – Promote (if accepted)
```bash
python experiments/scripts/promote.py --name <slug>
# Open PR against main using the printed description
```

---

## 6. Acceptance thresholds (immutable)

| Suite | Min pass rate | Notes |
|---|---|---|
| Smoke | 100% | Hard gate – must pass all cases |
| Benchmark | 80% | Regression allowed only if composite score improves |
| Holdout | 75% | Promotion gate |

Additionally:
- Latency must not regress more than **20%** vs baseline
- Composite score must **match or exceed** baseline

---

## 7. Simplicity criterion

A candidate that achieves **equivalent** results with **simpler** logic is preferred over one that achieves marginally better results with more complexity.

When deciding keep/reject at the margin, prefer the simpler option. Document the rationale in the manifest.

---

## 8. Experiment log (ledger)

Every `compare.py` run appends to `experiments/ledger.json`. This ledger is the permanent record. Do not edit it manually.

Each entry includes:
- `name` – experiment slug
- `suite` – which eval stage
- `decision` – accept | reject
- `rationale` – scoring details
- `hypothesis` – from the manifest
- `mutation_surface` – what was changed
- `timestamp` – UTC

---

## 9. Rejection is the default

If any eval stage does not pass its threshold, the candidate is **rejected automatically**. No human override is required to reject. A reject does not prevent a new experiment with a refined hypothesis.

---

## 10. Hard resource constraints

The following are hard limits that the eval harness enforces:

| Metric | Default limit | Config key |
|---|---|---|
| Output tokens | 512 | `EDGENT_MAX_TOKENS` |
| Per-request timeout | 30s | `EDGENT_TIMEOUT_SECONDS` |
| Tool calls per run | 5 | `EDGENT_MAX_TOOL_CALLS` |

Experiments must not circumvent these limits by changing the eval harness.
