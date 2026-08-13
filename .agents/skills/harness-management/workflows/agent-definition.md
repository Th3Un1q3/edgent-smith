# Modify an Agent Definition

Use this workflow to change an agent definition under `.opencode/agents/` when a recurring mistake traces to how the agent is instructed to behave.

## When to Use This Change Type

Use this change type when:
- You want to enhance an agent's orchestration process and principles to prevent repeated mistakes.
- You need to change an agent's identity, scope, workflow, tool or permission surface, or anti-patterns.
- A recurring failure traces to how an agent is instructed to behave.

## Decide: Is This the Right Change Type?

- Harness knowledge, not agent behavior, belongs in a skill or `AGENTS.md` — see [manage-skill.md](./manage-skill.md) and [directory-agents-md.md](./directory-agents-md.md).
- opencode config mechanics belong to `customize-opencode` (built-in) — reference it by name.

## Procedure

1. Identify the agent whose behavior causes the repeated mistake: `.opencode/agents/<name>.md`, for example `rug.md`, `rug-swe.md`, or `rug-team-coach.md`.
2. Read the file and locate the section governing the failing behavior: Identity, Workflow, Anti-Patterns, or the permission block.
3. Tighten that section: add an explicit anti-pattern naming the mistake, sharpen the workflow step, or adjust permissions. Prefer the narrowest change that prevents the mistake.
4. Keep the file's existing structure and headings.

## Format and Conventions

- YAML frontmatter with `name`, `mode`, `steps`, and a `permission` map, followed by a markdown body (`# Role` or `# Identity`, `## Core Principles`, `## Workflow`, `## Anti-Patterns`, routing tables as applicable).
- Validate the frontmatter parses as YAML before saving.

## Verify

- Re-read the file as the agent itself would, following its own workflow.
- Confirm the permission block is coherent with the workflow it governs.
- Confirm the change reads as a directive to the agent, not a description of it.

## Apply and Restart

- Agent definitions load at server start.
- Ask for an opencode restart to apply the change.
