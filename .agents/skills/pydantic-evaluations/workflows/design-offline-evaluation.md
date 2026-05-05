# Workflow: Design Offline Evaluation

Use this workflow to define a new offline evaluation suite around
`Dataset.evaluate(...)` or `Dataset.evaluate_sync(...)`.

## Steps

1. Choose the evaluation goal.
   - State what should improve or regress: correctness, latency, safety,
     retrieval quality, tool use, classifier calibration, or another property.
   - Decide whether the result should be an assertion, a numeric score, a label,
     or a combination.

2. Define the task contract.
   - Identify `InputsT`, `OutputT`, and `MetadataT`.
   - Decide whether `expected_output` exists and is trustworthy enough to drive
     evaluators such as `EqualsExpected`.
   - Prefer typed inputs and outputs when the task is structured.

3. Build the dataset.
   - Create a `Dataset` directly in code when iterating quickly.
   - Use descriptive `Case.name` values.
   - Put scenario facts in `metadata` when evaluators or later analysis need
     them.
   - Split smoke, regression, and comprehensive coverage into separate datasets
     when they serve different purposes.

4. Choose case evaluators.
   - Put deterministic checks first: `IsInstance`, `Equals`,
     `EqualsExpected`, `Contains`, `MaxDuration`.
   - Add `LLMJudge` only when quality is semantic or rubric-based.
   - Use case-specific evaluators when one rubric does not fit all cases.
   - Use `HasMatchingSpan` when success depends on execution behavior, not only
     final output.

5. Add report evaluators only if the question is aggregate.
   - Use `ConfusionMatrixEvaluator` for categorical prediction comparisons.
   - Use `PrecisionRecallEvaluator`, `ROCAUCEvaluator`, or
     `KolmogorovSmirnovEvaluator` when case evaluators emit confidence scores
     and binary truth signals.
   - Write a custom `ReportEvaluator` when the required analysis is business
     specific.

6. Instrument the task.
   - Use `increment_eval_metric(...)` for numeric counts and timings.
   - Use `set_eval_attribute(...)` for qualitative state such as cache hits,
     chosen route, source count, or model variant.
   - Keep attributes compact; store summaries instead of raw payloads.

7. Add lifecycle hooks only when per-case setup or cleanup is needed.
   - Use `CaseLifecycle.setup()` for case-scoped fixtures.
   - Use `prepare_context()` to derive metrics or attributes after the task runs.
   - Use `teardown()` for cleanup, optionally keeping failed resources for
     inspection.

8. Decide how the dataset will live.
   - Keep it in code during early iteration.
   - Move it to YAML or JSON with schema generation when it becomes a shared,
     reviewed artifact.

## Example

```python
from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import EqualsExpected, IsInstance, MaxDuration


dataset = Dataset(
    name='capital_eval',
    cases=[
        Case(
            name='capital_france',
            inputs='What is the capital of France?',
            expected_output='Paris',
            metadata={'difficulty': 'easy'},
        )
    ],
    evaluators=[
        IsInstance(type_name='str'),
        EqualsExpected(),
        MaxDuration(seconds=2.0),
    ],
)
```

## Clarification Triggers

Ask before proceeding if:
- The acceptance criterion is unclear: exact match, containment, rubric, or
  behavior.
- The task output shape is unclear.
- The user wants report-level analysis but has not identified the prediction and
  truth sources.
- The dataset should be generated, but the user has not said what distribution
  or coverage it should target.
