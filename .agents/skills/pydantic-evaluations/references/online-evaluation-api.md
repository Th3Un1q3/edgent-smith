# Reference: Online Evaluation API

## Primary APIs

| API | Purpose | Runtime behavior |
|---|---|---|
| `@evaluate(...)` | Attach evaluators to a sync or async function | Runs evaluators in the background after the function returns |
| `OnlineEvaluator` | Wrap one evaluator with sampling, sink, and concurrency policy | Controls per-evaluator behavior |
| `OnlineEvalConfig` | Shared defaults for online evaluation | Holds sinks, metadata, sampling behavior, error hooks, and OTel settings |
| `wait_for_evaluations()` | Wait for background evaluator work to finish | Useful in tests and short-lived scripts |
| `disable_evaluation()` | Suppress online evaluation in a scoped block | Useful in tests or maintenance flows |
| `run_evaluators(...)` | Execute evaluators against an existing `EvaluatorContext` | Useful for rerunning evaluators from stored data |
| `EvaluatorContextSource` | Fetch stored evaluator contexts from an external system | Useful for replay workflows |
| `OnlineEvaluation` | Attach online evaluation to a Pydantic AI agent | Evaluates completed agent runs in the background |

## Sampling And Concurrency

| Setting | Meaning |
|---|---|
| `sample_rate=1.0` | Evaluate every call |
| `sample_rate=0.0` | Never evaluate |
| callable `sample_rate` | Decide at runtime based on a `SamplingContext` |
| `sampling_mode='correlated'` | Share one sampling decision across evaluators for the same call |
| `max_concurrency` on `OnlineEvaluator` | Cap simultaneous evaluations for that evaluator; excess work is dropped, not queued |

## Delivery And Observability

| Mechanism | Purpose | Notes |
|---|---|---|
| default OTel event emission | Export evaluation results to telemetry backends | Cheap no-op if no OTel SDK is configured |
| `default_sink` on `OnlineEvalConfig` | Handle results in Python code | Useful for tests, alerting, or custom aggregation |
| per-evaluator `sink` | Override the default destination for one evaluator | Useful when one evaluator needs special handling |
| `emit_otel_events=False` | Disable default OTel delivery | Useful in harnesses that only care about sinks |

## Error Hooks

| Hook | Called for |
|---|---|
| `on_sampling_error` | Errors raised by a dynamic `sample_rate` callable |
| `on_max_concurrency` | Evaluations dropped because an evaluator is already at its concurrency limit |
| `on_error` | Sink delivery and related runtime errors |

## Agent Integration Notes

| Behavior | Meaning |
|---|---|
| target name | Taken from the decorated function name unless overridden; for agents it uses the agent `name` when present |
| dispatch timing | Evaluators run after a function returns or an agent run reaches a final result |
| streaming agent runs | Evaluators dispatch after the final result is available |
| `context.name` for agents | Populated with the agent run identifier |

## Rerun Support

| API | Use |
|---|---|
| `run_evaluators(...)` | Re-evaluate historical contexts with new or updated evaluators |
| `EvaluatorContextSource.fetch(...)` | Load one stored context |
| `EvaluatorContextSource.fetch_many(...)` | Load many stored contexts efficiently |
