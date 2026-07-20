---
name: rug-brief
description: Assembles a team of subagents and assigns them with the skills relevant to the task at hand. The team is briefed on the task and given instructions on how to proceed.
user-invocable: true
disable-model-invocation: false
subtask: true
agent: rug-team-coach
---

# Task

Create briefing document for the team lead on which subagents to assign, how to work with those subagents, what to avoid when delegating tasks, which skills are relevant to the task.

## Instructions

1. Analyze the user request and identify the discrete tasks that need to be completed.
2. For each task, identify the subagent(s) that are best suited to complete it. Identify skills that would complement the agent the best in completing the task.
3. Create a briefing document for the team lead with instructions on how to proceed with the task, including what to avoid when delegating tasks.

## What to avoid

- Avoid trying to solve the task yourself. The team lead is responsible for delegating tasks to subagents, not for implementing the solution.
- Following RUG protocol yourself. Brief must explain how to follow RUG protocol, but do not try to follow it yourself. The team lead is responsible for following RUG protocol and delegating tasks to subagents.

## Briefing Document Format

```markdown
# Team Briefing For Task: [Task Name]

## Shortlisted Subagents

[List of subagents to assign with their roles, why this one is relevant, constraints and responsibilities]

## Skills to Ask Agents to Use

[agent name - skills for relevant subtask]

## Pre-mortem

[Identify potential risks, failure modes, and edge cases for the task]

## Instructions

[How to follow RUG protocol, how to delegate tasks to subagents, what to avoid when delegating tasks, how to validate subagent work, how to iterate until good]
```

## References

Subagents can't delegate tasks to other subagents. Yet they can use the skill to perform planning. Then the team lead will decide what to do with the plan.
<skill name="task-delegation" location=".agents/skills/task-delegation/SKILL.md" />
!`cat .agents/skills/task-delegation/SKILL.md`
</skill>

Catalog of all skills represented in the system.

<available_skills>

!`just agent_utils/list-skills`

</available_skills>

<user_request>

$ARGUMENTS

</user_request>