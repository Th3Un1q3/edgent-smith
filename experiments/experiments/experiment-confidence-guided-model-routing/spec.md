# Hypothesis
Routing simple/low-complexity prompts to a tiny on-device model and escalating complex prompts to the default model will reduce average latency and cost while preserving pass-rates on the smoke evals.

# Motivation
Ideas.md lists "Model routing & hybrid on-device/VM strategies" as high-impact for edge. A confidence/complexity-based router is low-cost to prototype (heuristics + small local model) and can yield measurable latency/cost wins without changing core agent semantics.

# Type
Small architecture + runtime mutation (routing policy) — experimental feature toggle behind a simple heuristic and optional tiny local model alias.

# Mutation surface
- agents/edge.py: add a lightweight routing wrapper that selects between two model aliases (e.g., `edge_tiny` and the configured alias) based on prompt complexity and a fast confidence heuristic.
- config registry: ensure `edge_tiny` (quantized small model) is available in ModelConfig for experiments.
- evals/runner.py: add an evaluation run variant that toggles routing to measure latency/score tradeoffs.

# Implementation Instructions
1. Add a router function in agents/edge.py:
   - compute simple complexity score: prompt length, presence of question words, token heuristics; optionally run a single-shot tiny classifier model if available.
   - If complexity <= threshold, resolve model_config = resolve_model_config("edge_tiny"), else default.
   - Construct agent with selected model_config and continue normal run.
   - Expose toggle via env var `EDGENT_ROUTER_ENABLED=1` and threshold via `EDGENT_ROUTER_THRESHOLD`.
2. Add `edge_tiny` entry to the model registry (config.ModelConfig) pointing to a quantized tiny model alias; document that it should be a small on-device model.
3. Update evals/runner.py to accept `--router` flag or read `EDGENT_ROUTER_ENABLED` and run paired evals:
   - Baseline: current model alias
   - Routed: same alias with router enabled
   Collect candidate files for both runs (use baseline ids like `{alias}_smoke` and `{alias}_smoke_routed`).
4. Implement lightweight metrics collection: per-case latency, overall CI score, passing-case list (runner already records timings and passes).

# Validation (code, prompts, tasks)
- Code: run `just test` (if present) for any modified modules. Run `python -m agents.edge` dry-run with `DRY_RUN_LOCAL_LOOP=1` to ensure CLI path still works.
- Prompts/tasks: use existing `smoke_dataset` via `just eval`:
  - Run baseline: `EDGENT_MODEL_ALIAS=edge_agent_default just eval` (or use runner CLI)
  - Run routed: `EDGENT_ROUTER_ENABLED=1 EDGENT_MODEL_ALIAS=edge_agent_default just eval`
  - Compare `../{baseline}.baseline-candidate.json` outputs for score, avg_passing_case_seconds, and passing cases.
- Measure latency: confirm average passing-case time decreases for routed runs and that score does not regress beyond acceptable threshold (no regressions preferred).

# Anticipated missteps and fallbacks
- Misstep: router chooses tiny model for prompts requiring broader context leading to regressions. Fallback: conservative threshold, fallback to abstain/escalate when confidence low, and disable router via env var.
- Misstep: tiny model overhead (loading) outweighs benefits for small batch runs. Fallback: keep tiny model warm (preload) or only route when prompt length < N and runtime is interactive.
- Misstep: registry missing `edge_tiny`. Fallback: document and make experiment a noop when alias absent.

# Sources
- docs/ideas.md (Model routing & hybrid on-device/VM strategies)
- agents/edge.py (agent builder & model config wiring)
- evals/runner.py (evaluation harness & baseline mechanism)

# Notes
- Keep the router implementation minimal and toggleable; the experiment's goal is an A/B evaluation (latency vs pass-rate).
- If successful, follow-up experiments can add confidence calibration (LLM-based quick estimator) or learned routing models (small classifier).