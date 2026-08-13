# Maintain a Directory AGENTS.md Knowledge Base

Use this workflow to create or update a directory `AGENTS.md` that gives agents scoped, durable context for that directory and its subdirectories.

## When to Use This Change Type

Use this change type when:
- Agents need scoped context for a directory: key files, structure, commands, and what is in or out of scope.
- You want to orient any agent that works in the directory without it repeating the same questions.

## Decide: Is This the Right Change Type?

- Stable, durable context belongs in `AGENTS.md`.
- Transient or emergent knowledge belongs in memories — follow the `context-gathering` [store-memories](../../context-gathering/recipes/store-memories.md) recipe. `AGENTS.md` must not contain emergent behaviors.
- Root or project-level context belongs in the existing `/workspace/AGENTS.md`; edit it carefully because it is injected project-wide.

## Procedure

1. Identify the directory and the recurring questions agents ask there.
2. Create or modify `<directory>/AGENTS.md`.
3. Follow the canonical template used by existing files (read `/workspace/agents/AGENTS.md`): `# AGENTS KNOWLEDGE BASE (<Area>)`, `**OVERVIEW**`, `## STRUCTURE` (file tree), `## WHERE TO LOOK` (table or bullets), `## CONVENTIONS`, `## ANTI-PATTERNS (THIS DIRECTORY)`.
4. Keep it lean and stable — one way to do things per convention, no drift over time.

## Format and Conventions

- Name the file exactly `AGENTS.md` — case-sensitive.
- Scope content to the directory's own surface; do not restate project-wide context.
- Cite only paths and commands that are real and current.

## Verify

- Read it from the perspective of a fresh agent with no other context.
- Confirm every path and command resolves.
- Check that `## WHERE TO LOOK` answers the questions an agent would ask.

## Apply and Restart

- Tooling discovers directory `AGENTS.md` files for scoped context.
- Ask for an opencode restart so the change is picked up fully.
