---
name: pydantic-evaluations
description: >
  Build and operate Pydantic Evals workflows using a modular layout: a root
  skill router plus focused workflow and reference files for offline evals,
  experiment comparison, and online evaluation.
license: MIT
compatibility: Universal
metadata:
  version: "3.0.0"
  author: Th3Un1q3
---

# Pydantic Evaluations

Use this skill when the task is specifically about designing, running,
comparing, or operationalizing evaluations with `pydantic_evals`.

## When to Use This Skill

Invoke this skill when:
- The user wants an offline eval built around `Dataset`, `Case`, and
  `Evaluator`.
- The request mentions `pydantic_evals`, `LLMJudge`, report evaluators, repeat
  runs, or evaluation reports.
- The user wants to compare prompt versions, task implementations, model
  settings, or agent behaviors with a fixed dataset.
- The user wants to instrument eval runs with metrics, attributes, lifecycle
  hooks, retries, or concurrency controls.
- The user wants online evaluation on a function or a Pydantic AI agent.

## When Not to Use This Skill

Do not use this skill for:
- Generic testing guidance that does not use `pydantic_evals`.
- General prompt-writing advice without a request to measure outcomes.
- Business-logic debugging where the eval harness is not part of the problem.
- Pure observability questions that do not require eval design or operation.

## Task Routing Table

Load only the file relevant to the current task.

| I want to... | File |
|---|---|
| Design an offline evaluation from scratch | [workflows/design-offline-evaluation.md](./workflows/design-offline-evaluation.md) |
| Run, tune, and troubleshoot an offline evaluation | [workflows/run-and-tune-evaluation.md](./workflows/run-and-tune-evaluation.md) |
| Compare candidate implementations and iterate the dataset | [workflows/compare-and-iterate.md](./workflows/compare-and-iterate.md) |
| Attach online evaluation to a function or agent | [workflows/attach-online-evaluation.md](./workflows/attach-online-evaluation.md) |
| Look up the core data model and result objects | [references/core-constructs.md](./references/core-constructs.md) |
| Look up built-in case evaluators | [references/built-in-case-evaluators.md](./references/built-in-case-evaluators.md) |
| Look up report evaluators and analysis outputs | [references/report-evaluators-and-analyses.md](./references/report-evaluators-and-analyses.md) |
| Look up execution controls such as `repeat`, retries, and lifecycle hooks | [references/execution-controls.md](./references/execution-controls.md) |
| Look up dataset loading, saving, schema generation, and generation APIs | [references/dataset-management.md](./references/dataset-management.md) |
| Look up online evaluation APIs and runtime behavior | [references/online-evaluation-api.md](./references/online-evaluation-api.md) |

## Related Skills

- `building-modular-skills`
- `building-pydantic-ai-agents`
