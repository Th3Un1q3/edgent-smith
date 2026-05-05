# Workflow: Compare And Iterate

Use this workflow when the dataset already exists and the user wants to compare
candidates, analyze regressions, and evolve the suite without losing signal.

## Steps

1. Keep the dataset fixed.
   - Hold the same cases and evaluator configuration constant while comparing
     prompt versions, task implementations, or model settings.
   - Change one meaningful variable at a time.

2. Record experiment metadata from a single source of truth.
   - Use the same config object or constants for both task behavior and
     experiment metadata.
   - Do not hand-type metadata values that can drift from the actual task.

3. Run each candidate under the same conditions.
   - Match `repeat`, `max_concurrency`, retry settings, and dataset slice.
   - When the system is stochastic, compare grouped summaries rather than raw
     flat rows alone.

4. Compare the right outputs.
   - Use `report.averages()` for headline metrics.
   - Use `report.case_groups()` for stability and variance across runs.
   - Use `report.analyses` when report evaluators produce confusion matrices,
     PR curves, ROC AUC, KS statistics, tables, or custom summaries.
   - Inspect individual failing cases before drawing conclusions from overall
     averages.

5. Separate three outcomes.
   - Candidate regression: the same case fails under the new candidate.
   - Dataset gap: a bad behavior is missing from the dataset and needs a new
     case.
   - Evaluator gap: the evaluator is too weak, too noisy, or measuring the
     wrong thing.

6. Promote real failures into durable regression coverage.
   - Add newly discovered failure cases to the appropriate regression dataset.
   - Keep smoke datasets short and decisive.
   - Keep comprehensive datasets broad enough to catch drift, not just known
     bugs.

## Example

```python
report_a = dataset.evaluate_sync(task_a, repeat=3, metadata={'candidate': 'a'})
report_b = dataset.evaluate_sync(task_b, repeat=3, metadata={'candidate': 'b'})

avg_a = report_a.averages()
avg_b = report_b.averages()

groups_a = report_a.case_groups()
groups_b = report_b.case_groups()
```

## Clarification Triggers

Ask before proceeding if:
- The user wants to compare candidates but is changing the dataset at the same
  time.
- The user wants a single winner metric, but the task clearly has multiple
  competing objectives such as quality and latency.
- The user wants to weaken the dataset after a failure instead of adding a real
  regression case.
