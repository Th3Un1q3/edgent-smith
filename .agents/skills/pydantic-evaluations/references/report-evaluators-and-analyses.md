# Reference: Report Evaluators And Analyses

## Built-In Report Evaluators

| Evaluator | Purpose | Inputs it expects | Outputs |
|---|---|---|---|
| `ConfusionMatrixEvaluator` | Compare predicted vs expected classes across all cases | Predicted and expected values from `output`, `expected_output`, `metadata`, or `labels` | `ConfusionMatrix` |
| `PrecisionRecallEvaluator` | Build a precision-recall curve and AUC | Numeric scores from `scores` or `metrics`, plus binary truth from `assertions`, `labels`, or `expected_output` | `PrecisionRecall` and `ScalarResult` |
| `ROCAUCEvaluator` | Build ROC curve and AUC | Same score and truth inputs as `PrecisionRecallEvaluator` | `LinePlot` and `ScalarResult` |
| `KolmogorovSmirnovEvaluator` | Measure score separation for positive vs negative classes | Same score and truth inputs as `PrecisionRecallEvaluator` | `LinePlot` and `ScalarResult` |

## Common Parameters

| Parameter | Used by | Meaning |
|---|---|---|
| `predicted_from` | `ConfusionMatrixEvaluator` | Source of predicted values |
| `predicted_key` | `ConfusionMatrixEvaluator` | Key to read when prediction source is `metadata` or `labels` |
| `expected_from` | `ConfusionMatrixEvaluator` | Source of true values |
| `expected_key` | `ConfusionMatrixEvaluator` | Key to read when truth source is `metadata` or `labels` |
| `score_from` | PR, ROC, KS evaluators | Whether numeric scores come from evaluator `scores` or task `metrics` |
| `score_key` | PR, ROC, KS evaluators | Name of the numeric score |
| `positive_from` | PR, ROC, KS evaluators | Source of binary truth |
| `positive_key` | PR, ROC, KS evaluators | Name of the assertion or label to use as truth |
| `title` | all built-in report evaluators | Display title in reports and UIs |
| `n_thresholds` | PR, ROC, KS evaluators | Number of rendered threshold points |

## Analysis Types Returned By Report Evaluators

| Analysis type | Purpose | Typical producer |
|---|---|---|
| `ScalarResult` | Single headline metric | custom report evaluators, PR AUC, ROC AUC, KS statistic |
| `TableResult` | Structured summary table | custom report evaluators |
| `ConfusionMatrix` | Class-vs-class count matrix | `ConfusionMatrixEvaluator` |
| `PrecisionRecall` | Precision-recall curve data | `PrecisionRecallEvaluator` |
| `LinePlot` | Generic plotted curve | `ROCAUCEvaluator`, `KolmogorovSmirnovEvaluator`, custom report evaluators |

## Report Evaluator Context

| Field | Meaning |
|---|---|
| `ctx.name` | Experiment name |
| `ctx.report` | Full `EvaluationReport` |
| `ctx.experiment_metadata` | Optional run metadata passed to `evaluate(...)` |

## Serialization Notes

| Situation | Requirement |
|---|---|
| Built-in report evaluators in YAML or JSON datasets | No extra registration needed |
| Custom report evaluators loaded from file | Pass `custom_report_evaluator_types=[...]` |
| Custom report evaluators written to file with schema generation | Pass `custom_report_evaluator_types=[...]` to `to_file(...)` |
