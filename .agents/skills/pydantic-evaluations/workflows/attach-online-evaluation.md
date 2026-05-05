# Workflow: Attach Online Evaluation

Use this workflow when the user wants background evaluation on staging or
production traffic for a function or a Pydantic AI agent.

## Steps

1. Choose the target.
   - Use the `@evaluate(...)` decorator for a sync or async function.
   - Use the `OnlineEvaluation` capability for a Pydantic AI agent.
   - Pick a stable target name for downstream filtering and dashboards.

2. Choose evaluators by cost profile.
   - Run cheap heuristics broadly.
   - Sample expensive evaluators such as `LLMJudge` on a fraction of traffic.
   - Use per-evaluator `max_concurrency` for expensive checks so background work
     cannot grow without bound.

3. Configure the runtime.
   - Use `OnlineEvalConfig` for shared defaults such as metadata, sinks,
     sampling behavior, and OTel emission.
   - Override sample rates, sinks, or concurrency with `OnlineEvaluator` when a
     specific evaluator needs special handling.
   - Decide whether the results only need OTel events or also need a Python sink
     for tests, alerting, or custom aggregation.

4. Attach the evaluators.
   - Decorate the function or configure the agent capability.
   - For tests and scripts, use `wait_for_evaluations()` before exit so
     background work is observed.
   - Use `disable_evaluation()` in scopes where online eval must be suppressed.

5. Plan for stored-data re-evaluation when needed.
   - Use `run_evaluators(...)` to rerun evaluators from an existing
     `EvaluatorContext`.
   - Implement `EvaluatorContextSource` when contexts must be fetched from an
     external store.

## Example

```python
from dataclasses import dataclass

from pydantic_evals.evaluators import Evaluator, EvaluatorContext, LLMJudge
from pydantic_evals.online import OnlineEvalConfig, OnlineEvaluator


@dataclass
class OutputNotEmpty(Evaluator):
    def evaluate(self, ctx: EvaluatorContext) -> bool:
        return bool(ctx.output)


config = OnlineEvalConfig(default_sample_rate=1.0, metadata={'service': 'api'})


@config.evaluate(
    OutputNotEmpty(),
    OnlineEvaluator(
        evaluator=LLMJudge(rubric='Response is helpful and accurate'),
        sample_rate=0.05,
        max_concurrency=5,
    ),
)
async def summarize(text: str) -> str:
    return f'Summary of: {text}'
```

## Clarification Triggers

Ask before proceeding if:
- The user wants online evaluation but has not said whether background OTel
  events are enough or a custom sink is required.
- The user wants to run expensive evaluators on all traffic without a cost or
  concurrency plan.
- The user needs online evaluation for an agent but has not identified the
  agent's stable name or integration point.
