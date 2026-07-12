---
team:
    - name: rug-mcp
      agent-card: .agents/skills/task-delegation/agent-cards/rug-mcp.agent-card.md
    - name: rug-expert
      agent-card: .agents/skills/task-delegation/agent-cards/rug-expert.agent-card.md
description: >
  Example of using the RUG orchestrator pattern to decompose a user request into discrete, independently-completable agent subagent tasks and route them to specialized agents based on scope, expertise, and limitations.
---

# Workflow

[description]

## Task Delegation

[map of task and which agent to delegate to]

[what validation steps to take, and how to iterate until good]

## Failure Modes

[handling failure modes, including what to do if a subagent fails to complete a task, how to re-delegate, and how to validate results]