---
name: edge-architect-workflows
description: >
  Modular workflows for the edge architect flow: refresh ideas from the latest
  Hugging Face papers, turn ideas into one submitted experiment, or brainstorm
  eval extensions that push the edge agent beyond its comfort zone.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  author: Th3Un1qu3
---

# Edge Architect Workflows

Use this skill when the task is part of the edge architect workflow and the agent
needs reusable guidance that should not live in the stable agent entry point.

## When to Use This Skill

Invoke this skill when:
- The task is to refresh `docs/ideas.md` from the latest Hugging Face papers.
- The task is to read `docs/ideas.md`, create exactly one experiment spec, and submit it.
- The task is to brainstorm new evaluation extensions for the edge agent.

## When Not to Use This Skill

Do not use this skill for:
- Implementing an experiment in repository code.
- Running evals, validations, or CI workflows.
- General Copilot customization maintenance unrelated to the edge architect flow.

## Task Routing Table

Load only the file relevant to the current task.

| I want to... | File |
|---|---|
| Research the latest agentic-engineering papers with the Hugging Face CLI and update `docs/ideas.md` | [workflows/research-latest-agentic-insights.md](./workflows/research-latest-agentic-insights.md) |
| Read `docs/ideas.md`, create exactly one experiment spec, and submit it with `just autoresearch experiment create` | [workflows/create-experiment-from-ideas.md](./workflows/create-experiment-from-ideas.md) |
| Brainstorm eval extensions that stress the edge agent outside its comfort zone | [workflows/brainstorm-eval-extensions.md](./workflows/brainstorm-eval-extensions.md) |
| Look up the normal experiment output and submission contract | [references/experiment-contracts.md](./references/experiment-contracts.md) |

Queue-replenishment YAML stays inline in the shared edge-architect agent for automation and is not covered by this reference.

## Related Skills

- `building-modular-skills`
- `github-copilot-infrastructure`