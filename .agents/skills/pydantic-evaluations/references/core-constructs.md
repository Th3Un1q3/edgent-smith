# Reference: Core Constructs

## Primary Layers

| Construct | Layer | Purpose | Notes |
|---|---|---|---|
| `Dataset[InputsT, OutputT, MetadataT]` | Definition | Reusable eval suite | Holds cases, evaluators, and optional report evaluators |
| `Case` | Definition | One test scenario | Has `name`, `inputs`, optional `expected_output`, optional `metadata`, optional case-level evaluators |
| `Evaluator` | Definition | Per-case scoring or validation | Returns assertions, scores, labels, reasons, or named mappings |
| `ReportEvaluator` | Definition | Experiment-wide analysis | Runs after all case evaluators complete |
| `CaseLifecycle` | Definition | Per-case setup, context prep, and teardown | Passed as a class to `evaluate(...)` or `evaluate_sync(...)` |
| `Dataset.evaluate(...)` | Execution | Async experiment runner | Runs the task across cases |
| `Dataset.evaluate_sync(...)` | Execution | Sync wrapper | Same semantics as `evaluate(...)` |
| `EvaluatorContext` | Context | Per-run data exposed to evaluators | Includes inputs, output, expected output, metadata, duration, metrics, attributes, and span tree when available |
| `EvaluationReport` | Results | Final experiment output | Holds successful cases, failures, analyses, and run metadata |
| `ReportCase` | Results | Successful per-run result | Contains scores, labels, assertions, metrics, attributes, and durations |
| `ReportCaseFailure` | Results | Failed task execution result | Represents a case run that did not finish successfully |
| `ReportCaseGroup` | Results | Group of repeated runs for one source case | Available via `report.case_groups()` when `repeat > 1` |

## Evaluator Return Shapes

| Return shape | Meaning | Typical use |
|---|---|---|
| `bool` | Assertion | Pass or fail check |
| `int` or `float` | Score | Numeric quality signal |
| `str` | Label | Categorical classification |
| `EvaluationReason` | Explained result | Same as assertion, score, or label with a human-readable reason |
| `dict[str, ...]` | Multiple named outputs | Emit several related checks from one evaluator |

## Instrumentation Functions

| API | Scope | Purpose |
|---|---|---|
| `increment_eval_metric(name, value)` | Per case during task execution | Record numeric counters or measurements |
| `set_eval_attribute(name, value)` | Per case during task execution | Record qualitative or structured context |

## Metadata Scopes

| Scope | Set where | Used for |
|---|---|---|
| Case metadata | On `Case(...)` | Scenario facts used by the task or evaluators |
| Metrics | Inside the task | Numeric run data used by evaluators and reports |
| Attributes | Inside the task | Qualitative run data used by evaluators and reports |
| Experiment metadata | Passed to `evaluate(...)` | Tracking configuration for the full run |
