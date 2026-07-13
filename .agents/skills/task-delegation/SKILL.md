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
4. Identify subagent candidates, read their agent cards to understand their capabilities, scope, and limitations.
5. For each task, confirm matching subagent(s) that can complete the task within their scope and expertise.
6. Use the `task` tool to delegate each task to the appropriate subagent, providing clear instructions, acceptance criteria, and any necessary context.
7. Use the `todowrite` tool to track progress and ensure that each subagent completes their task successfully.
8. Use the `question` tool to ask for clarification or additional information from the user as needed.
9. Validate the results of each subagent's work independently, and iterate until the overall task is completed successfully.

## What Not to Do

- Delegate tasks without reading the agent cards and rightsizing the task to the subagent's capabilities.
- Attempt to complete tasks yourself or bypass the RUG orchestrator pattern. All work must be delegated to subagents with explicit scope and acceptance criteria.
- Sticking to the initial plan despite evidence that it is not working. Be flexible and willing to adjust the plan as needed based on feedback and results.

## Agent Cards

Reference cards for each of the four RUG orchestrator agents. Each card contains frontmatter (name, description, tasks, limits), delegation triggers, scope guardrails, and well-scoped / bad task examples.

For discovery, read the frontmatter of each agent card by using `read(filePath: '<agent-card-file-path>', start: 0, end: 20)`.
For using(BEFORE delegating), read the full agent card by using `read(filePath: '<agent-card-file-path>')`. Make sure to adhere to the scope and limits of each agent when delegating tasks.

| Agent | Card File | Purpose |
|-------|-----------|---------|
| [rug-expert](./agent-cards/rug-expert.agent-card.md) | `rug-expert.agent-card.md` | Complex planning, architecture design, validation strategy |
| [rug-mcp](./agent-cards/rug-mcp.agent-card.md) | `rug-mcp.agent-card.md` | External documentation lookup, searching web, API reference |
| [rug-puppet](./agent-cards/rug-puppet.agent-card.md) | `rug-puppet.agent-card.md` | Single-shot file reads, file searches, command execution, config edits |
| [rug-swe](./agent-cards/rug-swe.agent-card.md) | `rug-swe.agent-card.md` | Feature implementation, debugging, refactoring, multi-file changes |

Each card's frontmatter defines:
- **name** — Agent identifier used in routing decisions
- **description** — Scope and capability summary with trigger language
- **tasks** — List of atomic operations this agent handles (the delegation triggers)
- **limits** — What the agent cannot do or should not be asked to do

## Well-Known Workflows

Step-by-step task specific guides, explaining what agent team to use, how to route tasks, and how to validate results.

| Workflow | File | Purpose |
|----------|------|---------|
| Sample | [sample-workflow.md](./workflows/sample-workflow.md) | Example of using the RUG orchestrator pattern |
| Installing new software | not implemented | The right approach to install software (eg. using package managers like apt, yum, or brew) |
| Installing python libraries | not implemented | Not implemented |