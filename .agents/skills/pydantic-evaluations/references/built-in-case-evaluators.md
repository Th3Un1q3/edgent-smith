# Reference: Built-In Case Evaluators

| Evaluator | Best for | Return shape | Key parameters | Notes |
|---|---|---|---|---|
| `EqualsExpected` | Exact match against `case.expected_output` | `bool` | none | Skips cases where `expected_output` is `None` |
| `Equals` | Exact match to a fixed value | `bool` | `value`, `evaluation_name` | Useful for sentinel outputs or fixed categories |
| `Contains` | Required substring, membership, or partial structure check | `EvaluationReason` | `value`, `case_sensitive`, `as_strings`, `evaluation_name` | Works on strings, lists, tuples, and dict key-value containment |
| `IsInstance` | Output type validation | `EvaluationReason` | `type_name`, `evaluation_name` | Matches built-ins and custom class names |
| `MaxDuration` | Latency thresholds | `bool` | `seconds` | Accepts float seconds or `timedelta` |
| `LLMJudge` | Rubric-based semantic quality checks | configurable assertion and or score | `rubric`, `model`, `include_input`, `include_expected_output`, `model_settings`, `score`, `assertion` | Use after deterministic checks because it is slower and costlier |
| `HasMatchingSpan` | Behavioral validation from OTel traces | `bool` | `query`, `evaluation_name` | Requires captured spans and is useful for tool-use or flow assertions |

## Practical Ordering

| Order | Evaluator type | Reason |
|---|---|---|
| 1 | `IsInstance` | Fail fast on shape mismatches |
| 2 | `Equals`, `EqualsExpected`, `Contains` | Cheap correctness or content checks |
| 3 | `MaxDuration` | Cheap latency threshold |
| 4 | custom deterministic evaluators | Domain-specific logic without extra model cost |
| 5 | `LLMJudge` | Expensive semantic assessment |

## Common Fit

| Problem shape | Preferred evaluator |
|---|---|
| Exact output must match | `EqualsExpected` |
| Output must equal a fixed status | `Equals` |
| Output must include required content | `Contains` |
| Output must conform to a type contract | `IsInstance` |
| Response must stay under an SLA | `MaxDuration` |
| Quality is semantic or rubric-based | `LLMJudge` |
| Correctness depends on internal execution behavior | `HasMatchingSpan` |
