# Reference: Execution Controls

## Experiment Controls

| Control | Scope | Purpose | Typical use |
|---|---|---|---|
| `max_concurrency` | Experiment | Limit parallel task and evaluator execution | Reduce rate-limit pressure, resource use, and debugging complexity |
| `repeat` | Experiment | Run each case multiple times | Measure stochastic variability and compute grouped summaries |
| `retry_task` | Experiment | Retry the task under test using Tenacity | Handle transient task failures such as rate limits or timeouts |
| `retry_evaluators` | Experiment | Retry evaluator execution using Tenacity | Handle flaky remote evaluators such as `LLMJudge` |
| `metadata` | Experiment | Record run-level configuration | Track model, prompt version, feature flag state, or region |
| `lifecycle` | Experiment | Apply a `CaseLifecycle` class to every case | Per-case setup, context enrichment, and teardown |

## Concurrency Guidance

| Situation | Suggested setting |
|---|---|
| Debugging failures | `max_concurrency=1` |
| Moderate remote API limits | low to moderate concurrency, sized to provider limits |
| Expensive evaluators in the suite | lower concurrency than the task alone might allow |
| CPU or memory heavy local work | concurrency matched to actual resource limits |

## Retry Guidance

| Retry target | Good for | Avoid for |
|---|---|---|
| `retry_task` | rate limits, network timeouts, temporary outages | permanent validation or logic errors |
| `retry_evaluators` | remote judge failures, flaky external checks | deterministic evaluator bugs |

## Multi-Run Semantics

| Behavior | Meaning |
|---|---|
| `repeat=1` | Standard single-run evaluation |
| `repeat > 1` | Each source case is run multiple times |
| `report.case_groups()` | Returns grouped runs by original case name when repeats are enabled |
| `source_case_name` | Preserves the original case name for repeated runs |
| `report.averages()` with repeats | Uses two-level aggregation: per-group first, then across groups |

## Lifecycle Order

| Stage | Called when |
|---|---|
| `setup()` | Before task execution |
| task | After `setup()` |
| `prepare_context()` | After task output exists, before evaluators run |
| evaluators | After context preparation |
| `teardown()` | After evaluator completion, with success or failure result |

## Failure Surfaces

| Location | Where to inspect |
|---|---|
| Task execution failure | `report.failures` |
| Evaluator failure | `case.evaluator_failures` |
| Aggregate report analysis | `report.analyses` |
