---
name: harness-management
description: >-
  Route harness changes to the right place: scoped instructions in
  .opencode/instructions/, skills in .agents/skills/, directory knowledge bases
  in AGENTS.md, or agent definitions in .opencode/agents/. Use when a repeated
  agent mistake or knowledge gap is best fixed by a persistent harness change,
  when you need to create or update scoped instructions, a skill, a directory
  knowledge base, or an agent definition, or when you want to memorize a process
  or workflow so it is followed consistently. Not for one-off fixes that do not
  need to persist, opencode config mechanics, or transient knowledge.
license: MIT
compatibility: Universal
metadata:
  version: "1.1.0"
  author: Th3Un1qu3
---

# Harness Management

The harness is the persistent guidance that shapes agent behavior: scoped instructions, skills, directory knowledge bases, and agent definitions. Use this skill to decide where a harness change belongs, then follow the matching workflow.

## When to Use

Invoke this skill when:
- Deciding where a harness change belongs: instructions, skill, AGENTS.md, or agent definition.
- A repeated agent mistake or knowledge gap is best fixed by a persistent harness change.
- You need to create or update scoped instructions, a skill, a directory knowledge base, or an agent definition.
- You want to memorize a process or workflow so it is followed consistently.

## When Not to Use

Do not use this skill for:
- One-off fixes that do not need to persist as guidance.
- Legacy Copilot-stack customization (`.github/agents`, `.github/prompts`, `.github/instructions`) — out of scope; the harness is opencode-based and Copilot customization is no longer built.
- opencode config mechanics — use `customize-opencode` (built-in).
- Storing transient knowledge — use `context-gathering` (memories).

## Change Type Reference

| Your goal | Change type | Where it lives | Workflow |
|---|---|---|---|
| Improve quality or accuracy of editing a specific file type (markdown, code, config) | Scoped instructions | `.opencode/instructions/<name>.instructions.md` | [workflows/scoped-instructions.md](./workflows/scoped-instructions.md) |
| Improve or memorize a process or workflow | Skill — find, modify, or create | `.agents/skills/<name>/` | [workflows/manage-skill.md](./workflows/manage-skill.md) |
| Provide scoped context for a directory and its subdirectories (key files, structure, commands, in/out of scope) | Directory knowledge base | `<directory>/AGENTS.md` | [workflows/directory-agents-md.md](./workflows/directory-agents-md.md) |
| Enhance orchestration process and principles to prevent repeated agent mistakes | Agent definition | `.opencode/agents/<name>.md` | [workflows/agent-definition.md](./workflows/agent-definition.md) |

Starting from a diagnosis instead of a goal (e.g. a session audit finding)? Map the finding to a change type with [references/improvement-patterns.md](./references/improvement-patterns.md).

## Workflow

1. Decide which change type(s) fit your case and objectives using the Change Type Reference table.
2. Read the workflow file(s) for the change type(s) you selected.
3. Execute the changes as the workflow describes.
4. Ask for an opencode restart to apply the changes — agents, plugins, and skills load at server start.

## Related Skills

- `building-modular-skills` — authoring workflow, multi-file layout, completion gate.
- `customize-opencode` (built-in) — opencode config, agents, and plugins mechanics.
- `find-skills` — discover existing skills before creating new ones.
- `skill-creator` — create, modify, and benchmark skills.
- `context-gathering` — store transient knowledge as memories.
- `session-insights` — analyze session exports; its audit findings map to change types via [references/improvement-patterns.md](./references/improvement-patterns.md).
