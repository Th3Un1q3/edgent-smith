---
name: task-delegation
description: >
  Teaches the RUG (Repeat Until Good) orchestrator pattern for decomposing user requests into discrete, independently-completable agent subagent tasks and routing them to specialized agents based on scope, expertise, and limitations.
license: MIT
metadata:
  version: "1.0"
  author: "Th3Un1qu3"
---

# Task Delegation Skill

Teaches the RUG (Repeat Until Good) orchestrator pattern for decomposing user requests into discrete, independently-completable agent subagent tasks and routing them to specialized agents based on scope, expertise, and limitations.

## Mandatory Steps for Delegating Tasks

1. Identify the user request and desired outcome.
2. Look through the list of workflows to see if there is a ready-made recipe for the task in [Well-Known Workflows](#well-known-workflows). If so, follow the workflow steps.
3. If no workflow exists, decompose the user request into discrete tasks.
4. For each task identify skills that are relevant to the task that are best suited to complete it.
5. Use the `task` tool to delegate each task to the appropriate subagent, providing clear instructions, acceptance criteria, and any necessary context.
6. Use the `todowrite` tool to track progress and ensure that each subagent completes their task successfully.
7. Use the `question` tool to ask for clarification or additional information from the user as needed.
8. Validate the results of each subagent's work independently, and iterate until the overall task is completed successfully.

## What Not to Do

- Delegate tasks without reading the agent cards and rightsizing the task to the subagent's capabilities.
- Attempt to complete tasks yourself or bypass the RUG orchestrator pattern. All work must be delegated to subagents with explicit scope and acceptance criteria.
- Sticking to the initial plan despite evidence that it is not working. Be flexible and willing to adjust the plan as needed based on feedback and results.

## Well-Known Workflows

Step-by-step task specific guides, explaining what agent team to use, how to route tasks, and how to validate results.

| Workflow | File | Purpose |
|----------|------|---------|
| Sample | [sample-workflow.md](./workflows/sample-workflow.md) | Example of using the RUG orchestrator pattern |
| Installing new software | not implemented | The right approach to install software (eg. using package managers like apt, yum, or brew) |
| Installing python libraries | not implemented | Not implemented |