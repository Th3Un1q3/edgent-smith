# Workflow: Run And Tune Evaluation

Use this workflow after the dataset and evaluators already exist and the goal is
stable execution, reliable signals, and readable failures.

## Steps

1. Start with a smoke run.
   - Run a small representative slice first.
   - Use `max_concurrency=1` and `repeat=1` to make failures easy to read.
   - Confirm that metrics, attributes, and evaluator outputs are actually
     present in the report.

2. Tune concurrency.
   - Keep `max_concurrency=1` during debugging.
   - Increase concurrency only to the level supported by rate limits, compute
     limits, and budget.
   - Remember that expensive evaluators such as `LLMJudge` also run under the
     experiment's concurrency model.

3. Add retries for transient failures.
   - Use `retry_task` for rate limits, timeouts, and temporary service issues in
     the task under test.
   - Use `retry_evaluators` for flaky evaluator logic, especially remote judges.
   - Do not use retries to hide permanent logic errors.

4. Enable repeat for stochastic systems.
   - Use `repeat > 1` when model output varies meaningfully across identical
     inputs.
   - Inspect `report.case_groups()` instead of relying only on flat case output.
   - Compare grouped summaries, not one lucky run.

5. Inspect failures at the correct layer.
   - Use `report.failures` for task execution failures.
   - Use `case.evaluator_failures` for evaluator-specific failures.
   - Use `report.analyses` for report-evaluator output.

6. Tighten the harness only after the run is stable.
   - Lower thresholds or add stricter evaluators only when the dataset reflects
     real acceptance criteria.
   - Add cases for newly discovered failures instead of weakening useful
     evaluators.

## Example

```python
from tenacity import stop_after_attempt, wait_exponential

report = dataset.evaluate_sync(
    task,
    max_concurrency=2,
    repeat=3,
    retry_task={
        'stop': stop_after_attempt(5),
        'wait': wait_exponential(multiplier=1, min=1, max=30),
        'reraise': True,
    },
    retry_evaluators={
        'stop': stop_after_attempt(3),
        'wait': wait_exponential(multiplier=0.5, min=0.5, max=10),
        'reraise': True,
    },
    metadata={'model': 'candidate-a', 'prompt_version': 'v2'},
)
```

## Clarification Triggers

Ask before proceeding if:
- The user is seeing failures but cannot say whether they come from the task or
  the evaluators.
- The system is stochastic but the user still expects single-run output to be
  decisive.
- The user wants more retries even though the error looks permanent rather than
  transient.
- The user wants higher concurrency without stating rate-limit or cost
  constraints.
