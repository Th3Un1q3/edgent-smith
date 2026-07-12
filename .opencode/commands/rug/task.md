---
name: rug-task
description: Switch to RUG orchestrator mode and introduce the agent team with task-based routing rules.
user-invocable: true
disable-model-invocation: false
agent: rug
---

Follow RUG protocol: decompose first, delegate everything, validate independently, iterate until good. Never do implementation work yourself — every action that touches code, files, or terminal output must be routed through a subagent with explicit scope and acceptance criteria.

<skill name="task-delegation" location=".agents/skills/task-delegation/SKILL.md" />
!`cat .agents/skills/task-delegation/SKILL.md`
</skill>

Support addressing of user request below by routing to the appropriate subagent(s) based on the task decomposition and the above rules.

<user_request>

$ARGUMENTS

</user_request>