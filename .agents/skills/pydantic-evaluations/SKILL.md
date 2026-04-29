---
name: pydantic-evaluations
description: Guidelines on designing efficient, reliable evaluations using the pydantic_evals library from Pydantic AI. Use when You want reproducible, auditable evaluations of model outputs. You need to compare implementations, track pass rate or latency, or add LLM rubric-based grading (LLMJudge).
---


Purpose
-------
Provide a compact, repeatable workflow and checklist for designing efficient,
reliable evaluations using the `pydantic_evals` package from the Pydantic AI
project. This skill converts the library's best practices into a small,
actionable process you (or an agent) can follow when creating datasets,
choosing evaluators, tuning concurrency, and instrumenting runs.

Scope
-----
- Workspace-scoped evaluation design for modelled tasks (text, structured
  outputs, JSON, etc.).
- Focus on evaluation efficiency, reliability, and observability.

What this skill produces
------------------------
- A clear evaluation goal and pass criteria.
- A `Dataset` composed of well-formed `Case` objects and an ordered list of
  evaluators (fast checks first, LLM judges last).
- A repeatable run invocation (example `evaluate_sync(...)` call) with
  recommended `max_concurrency`, `repeat`, and lifecycle hooks configured.
- A short checklist to validate the experiment before broad runs.

When to use
-----------
- You want reproducible, auditable evaluations of model outputs.
- You need to compare implementations, track pass rate or latency,
  or add LLM rubric-based grading (LLMJudge).

Step-by-step workflow (practical)
-------------------------------
1. Define the evaluation goal and success criteria.
   - What is a pass? (exact match, contains, rubric score >= X)
   - Budget and latency constraints.

2. Design `Case`s and the `Dataset`.
   - Give every case a `name` (required going forward).
   - Put `inputs`, optional `expected_output`, and `metadata`.

3. Choose and order evaluators.
   - Fast deterministic checks first: `IsInstance`, `Contains`, `Equals`,
     `EqualsExpected`, `MaxDuration`.
   - Expensive or probabilistic checks (LLM-based) last: `LLMJudge`.
   - Fail-fast ordering saves cost when early checks fail.

4. Concurrency and rate-limits.
   - Start locally with `max_concurrency=1` (debug), then scale up to a value
     that matches your rate limits and cost profile (e.g., 5–20).

5. Repeats for stochastic models.
   - Use `repeat` to sample nondeterministic models; aggregate runs by
     `case.name` to compute mean/median/variance.

6. Lifecycle hooks and setup/teardown.
   - Use `CaseLifecycle` for per-case setup (mocking, seeding) and teardown.

7. Instrumentation and tracing.
   - Use `TaskRun` helpers to set attributes and counters.
   - Optionally emit OpenTelemetry spans / Logfire events for each case.

8. Run small smoke tests.
   - One-case runs, `max_concurrency=1`, `repeat=1` to verify evaluator logic.

9. Full run and analysis.
   - Run with chosen `max_concurrency` and `repeat`.
   - Use `ReportEvaluator`s and `report.averages()` to compute pass rates.

10. Iterate — refine cases, evaluator thresholds, and instrumentation.

Decision points & branching
---------------------------
- Expected strictness:
  - Use `expected_output` and `EqualsExpected` for strict outputs.
  - Use `LLMJudge` for rubric-based natural language grading.
- Concurrency vs cost:
  - More concurrency reduces wall time but increases parallel API calls and
    cost; test for rate limits.
- Repeat counts for stochastic tasks:
  - Start with 3–5 repeats for sanity; increase for statistically robust
    estimates.

Quick checklist (pre-run)
-------------------------
- Every `Case` has a `name` and required inputs.
- Fast evaluators included to fail fast.
- `MaxDuration` set where latency matters.
- `max_concurrency` is tuned to provider rate limits.
- `repeat` chosen for stochastic workloads.
- Observability (TaskRun attributes / OTel) configured if needed.

Examples
--------
Minimal synchronous run (fast checks first, LLMJudge last):

```python
from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import IsInstance, Contains, LLMJudge, MaxDuration

dataset = Dataset(
    name='capital_eval',
    cases=[Case(name='capital_paris', inputs='What is the capital of France?', expected_output='Paris')],
    evaluators=[
        IsInstance(type_name='str'),
        Contains(value='Paris', case_sensitive=False),
        MaxDuration(seconds=2.0),
        LLMJudge(rubric='Answer correctly names the country capital'),
    ],
)

def answer_question(question: str) -> str:
    return 'Paris'

report = dataset.evaluate_sync(answer_question, max_concurrency=5, repeat=1)
report.print(include_input=True, include_output=True)
```

Parallel / repeated evaluation for stochastic models:

```python
report = dataset.evaluate_sync(answer_question, max_concurrency=5, repeat=5)
# aggregate and inspect
print(report.averages())
```

Top 20 concepts (concise guide)
--------------------------------
Below are the 20 most useful concepts from `pydantic_evals` to design efficient
evaluations. Each item includes what it is, why it matters, where it lives in
the codebase, and a representative link.

1) Dataset and Case (core data model)
   - What: `Dataset` and per-row `Case` store inputs, expected outputs, metadata.
   - Why: They define the evaluation surface and drive runs & reports.
   - Where: `pydantic_evals/pydantic_evals/dataset.py`
   - Link: https://github.com/pydantic/pydantic-ai/blob/main/pydantic_evals/pydantic_evals/dataset.py

2) Evaluator base class and API
   - What: Abstract `Evaluator` you subclass to implement `evaluate(ctx)`.
   - Why: Extensibility point for custom metrics and labelers.
   - Where: `pydantic_evals/pydantic_evals/evaluators/evaluator.py`
   - Link: https://github.com/pydantic/pydantic-ai/blob/main/pydantic_evals/pydantic_evals/evaluators/evaluator.py

3) EvaluationResult / EvaluationReason / EvaluatorFailure
   - What: Typed outputs and failure containers from evaluators.
   - Why: Standardized records for aggregation and diagnostics.
   - Where: `evaluator.py` (same folder as above)

4) Built-in default evaluators
   - What: `Equals`, `EqualsExpected`, `Contains`, `IsInstance`, `MaxDuration`, `LLMJudge`.
   - Why: Fast coverage for common checks; use them first for fail-fast behavior.
   - Where: `pydantic_evals/pydantic_evals/evaluators/common.py`

5) LLM-as-a-judge pattern (LLMJudge)
   - What: Uses a small agent to grade outputs by rubric, returning structured grades.
   - Why: Rubric-based grading for subjective tasks.
   - Where: `evaluators/llm_as_a_judge.py` and `common.py`

6) EvaluatorSpec / serialization + registry
   - What: Serializer for evaluators so datasets are declarative (YAML/JSON).
   - Why: Store/evolve datasets in files with schema validation.
   - Where: `evaluators/spec.py` and dataset serialization helpers.

7) Dataset serialization & schema generation
   - What: `Dataset.from_file` / `to_file` / `model_json_schema_with_evaluators`.
   - Why: Editor-friendly dataset files and JSON schema support.
   - Where: `dataset.py` methods around I/O and schema generation.

8) Concurrency and async-first design
   - What: Async evaluation with `max_concurrency`, anyio task groups.
   - Why: Run many cases in parallel while obeying limits.
   - Where: `dataset.py` (evaluate & concurrency code).

9) Repeat runs and aggregation support
   - What: `repeat` parameter to sample stochastic tasks.
   - Why: Aggregate multiple runs to reduce noise.
   - Where: `dataset._build_tasks_to_run` and evaluate logic.

10) Lifecycle hooks per-case (CaseLifecycle)
   - What: Setup/prepare/teardown hooks per `Case`.
   - Why: Inject per-case environment setup and cleanup.
   - Where: `pydantic_evals/pydantic_evals/lifecycle.py`

11) Task run instrumentation: metrics and attributes
   - What: `TaskRun` to capture attributes, counters, and metrics.
   - Why: Add custom runtime metrics for dashboards and analysis.
   - Where: `_task_run.py` and dataset helpers.

12) Observability — OpenTelemetry / Logfire
   - What: Spans and SpanTree emission for per-case tracing.
   - Why: Deep observability and debugging for evaluation runs.
   - Where: `_otel_emit.py` and OTel integration code.

13) Reporting model (EvaluationReport, ReportCase)
   - What: Rich report objects that collect per-case results and aggregates.
   - Why: Programmatic analysis and CLI-friendly printing.
   - Where: `reporting` package inside `pydantic_evals`.

14) Report evaluators (experiment-level analytics)
   - What: Run evaluators against the whole report for aggregate metrics.
   - Why: Compute confusion matrices, aggregate pass rates, and stats.
   - Where: `evaluators/report_evaluator.py`

15) run_evaluator helper (retries, error conversion)
   - What: Runs evaluators with retries and converts exceptions to `EvaluatorFailure`.
   - Why: Robust handling of flaky evaluator code or network calls.
   - Where: `evaluators/_run_evaluator.py`

16) Grouping evaluator outputs by type
   - What: Helpers that group outputs into assertions, scores, and labels.
   - Why: Easier aggregation and display logic for different result types.
   - Where: grouping helpers inside `dataset.py`.

17) Error handling and failures (ReportCaseFailure)
   - What: Structured capture of errors with stack traces and types.
   - Why: Keeps runs resumable and provides diagnostics.
   - Where: `dataset.py` error handling blocks.

18) Online evaluation & sinks
   - What: Stream results to sinks or telemetry backends while running.
   - Why: Real-time dashboards for long-running experiments.
   - Where: `online.py`, `_online.py`, `_otel_emit.py`.

19) Type-safety & Pydantic integration
   - What: `BaseModel`, `TypeAdapter`, generics and schema generation.
   - Why: Strong typing and safe dataset/evaluator serialization.
   - Where: `dataset.py` and evaluator modules.

20) Utilities and developer ergonomics
   - What: Progress bar, `evaluate_sync`, `get_event_loop`, and helpers.
   - Why: Easier local runs and synchronous wrappers for scripts.
   - Where: `_utils.py`, `evaluator.py`, and `dataset.py`.

Gaps, TODOs & follow-ups
------------------------
- Decide pass thresholds (numeric/boolean) for each dataset before large runs.
- If using `LLMJudge`, pin a model or serialization strategy for reproducibility.
- Add report evaluators when you need cross-case analytics (confusion matrices).
