# Hypothesis
A small library of reusable, on-device evaluator templates (fast smoke/unit-style checks for skills) will detect regressions and runtime performance regressions early with minimal compute and developer time, improving iteration speed for edge experiments.

# Motivation
Docs/ideas.md highlights "Reusable evaluators and skill templates" as high-impact for edge. The repo already has a smoke eval runner (evals/runner.py); adding lightweight templates that run synchronously and require minimal model calls is low-cost and enables faster feedback loops for agent mutations.

# Type
Architecture + tooling experiment: add test/evaluator templates and a thin integration into the existing smoke eval flow.

# Mutation surface
- Add `evals/templates/local_smoke_template.py` (reusable evaluator class + small helper dataset pattern)
- Add one sample evaluator for an existing skill (e.g., calculator or web_search_stub behavior) under `evals/samples/`.
- Small edit to `evals/runner.py` docs or comments to reference the template (no behavioral change required).

# Implementation Instructions
1. Create `evals/templates/local_smoke_template.py` exporting:
   - `LocalSkillEvaluator` class: sync API `evaluate_sync(run_fn, max_concurrency=1)` returning a pydantic_evals-style `EvaluationReport`-like object (or a thin dict) with cases, assertions, and timings.
   - `make_simple_case(name, input, expected_output_predicate)` helper to build cases.
2. Add `evals/samples/calculator_smoke.py` that defines 6-8 short cases for the `calculator` inline tool (edge agent), covering correctness, division-by-zero, and expression length limits. Use the template API.
3. Add a short README in `evals/templates/README.md` describing how to author new templates and hook them into `just eval` via `--set calculator_smoke`.
4. Keep implementations synchronous and deterministic; avoid external network access.
5. No model or eval runner changes required beyond documenting how to run the sample via `just eval --set calculator_smoke` (or `--set calculator_smoke` if registered).

# Validation (code, prompts, tasks)
- Code: Unit tests under `tests/test_eval_templates.py` that exercise `LocalSkillEvaluator` using the calculator sample and assert expected pass/fail counts and that evaluation completes in <5s on typical dev hardware.
- Prompts: None required (evaluators call tools/functions directly). The sample cases include example inputs and the expected predicate.
- Tasks to run manually:
  - `just test tests/test_eval_templates.py -q` (unit tests)
  - `just eval --set calculator_smoke` to run the sample evaluator end-to-end and confirm it prints results and writes a candidate file (if runner wiring is used).

# Anticipated missteps and fallbacks
- Misstep: Trying to reuse full pydantic_evals internals may add heavy deps. Fallback: keep the template dependency-free and return a simple JSON-like report that `evals/runner.py` can print.
- Misstep: Tying templates to the eval runner requires baseline plumbing. Fallback: keep the first iteration as a standalone `just`-invokable script under `evals/samples/` and integrate later.
- Misstep: Tests that rely on wall-clock timings may be flaky. Fallback: assert pass/fail counts primarily and use loose timing assertions (e.g., <10s) or mock durations in unit tests.

# Sources
- docs/ideas.md — "Reusable evaluators and skill templates" (lines 17–21)
- evals/runner.py — existing smoke eval runner and dataset-loading patterns
- agents/edge.py — inline tools (calculator) that make good, low-cost sample targets

# Notes
- Goal is minimal friction: authors can add new skill smoke checks with a single small Python file using the template.
- Keep privacy in mind: avoid sending any device-local data off-device in these templates.