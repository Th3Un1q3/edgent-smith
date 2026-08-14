# Improvement Patterns: From Findings to Harness Changes

This reference answers "which kind of improvement fits this issue?" — it maps a diagnosis of a failed or partial session to the harness change type that addresses it. Each pattern links to the workflow that implements the change. The full Change Type Reference — including the directory `AGENTS.md` change type, which has no pattern here — lives in [../SKILL.md](../SKILL.md).

## Usage

After completing a session review (or diagnosing any recurring agent mistake), map each finding to the pattern below that best describes it, then follow the linked workflow for the matching change type.

## Finding → Improvement Map

| Finding | Pattern | Change type | Workflow |
|---|---|---|---|
| A relevant skill loaded but the objective was not achieved | P1 — Skill loaded, objective not achieved | Skill — modify | [manage-skill.md](../workflows/manage-skill.md) |
| No relevant skill loaded and the objective was not achieved | P2 — No skill loaded, objective not achieved | Skill — create | [manage-skill.md](../workflows/manage-skill.md) |
| Files were edited but ineffectively (overcomplicated, missed test cases) | P3 — Files edited ineffectively | Scoped instructions | [scoped-instructions.md](../workflows/scoped-instructions.md) |
| The initial request was too large, vague, or complex | P4 — Request too large or vague | Agent definition | [agent-definition.md](../workflows/agent-definition.md) |

## Patterns

### P1 — Relevant skill loaded but objective not achieved

**Trigger:** the objective was "not achieved" AND skills were loaded during the session

*Action:* Update the skill to make it more actionable and include more specific instructions for the agent to follow. Follow [manage-skill.md](../workflows/manage-skill.md).

### P2 — No relevant skill loaded and objective not achieved

**Trigger:** the objective was "not achieved" AND no skills were loaded during the session

*Action:* Add a new skill to the agent's skillset that is relevant to the session's objective. Search with `find-skills` before creating — prefer modifying an existing skill over creating a new one. Follow [manage-skill.md](../workflows/manage-skill.md).

### P3 — Files were edited but ineffectively (overcomplicated, missed test cases)

**Trigger:** the objective was "partially achieved" AND file-editing tools were used

*Action:*
- Review the available instructions in `.opencode/instructions/` to understand what exists.
- If relevant instructions were shown — update them to be more actionable and include more specific guidance for the agent to follow.
- If relevant instructions exist but were not shown — update them to include file globs so they are shown in relevant edits.
- If no relevant instructions exist — add new instructions relevant to the session's objective.

Follow [scoped-instructions.md](../workflows/scoped-instructions.md).

### P4 — Initial request was too large, vague, or complex

**Trigger:** the root cause mentions scope/complexity OR the session shows a high ratio of text to tool parts

*Action:* Identify what change to the agent definition (`.opencode/agents/`, for example `rug.md`) would help break down such requests better. Follow [agent-definition.md](../workflows/agent-definition.md).
