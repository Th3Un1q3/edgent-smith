# Find, Modify, or Create a Skill

Use this workflow to locate existing skills first, then modify or create the skill that packages a process or workflow as reusable guidance.

## When to Use This Change Type

Use this change type when:
- You want to improve or memorize a process or workflow.
- A repeated behavior is worth packaging as reusable guidance.
- Existing guidance is scattered across instructions or prompts and needs one home.

## Decide: Is This the Right Change Type?

- Search before creating. Use the `find-skills` skill to discover candidates, both local and installable.
- Prefer modifying an existing skill over creating a new one; a new skill carries discovery and maintenance cost.
- Guidance scoped to editing one file type belongs in instructions — see [scoped-instructions.md](./scoped-instructions.md).
- opencode config mechanics belong to `customize-opencode` (built-in) — reference it by name.

## Procedure

1. Find candidates with the `find-skills` skill; check whether one already covers the process.
2. If modifying: load `building-modular-skills` and follow its [workflows/authoring-workflow.md](../../building-modular-skills/workflows/authoring-workflow.md).
3. If creating: use the `building-modular-skills` authoring workflow — a multi-file layout with a lean root `SKILL.md` (≤ ~90 lines) plus `workflows/` and `references/` — or use `skill-creator` to create, modify, and benchmark skills.
4. Before declaring done, run the completion gate [workflows/shaping-checklist.md](../../building-modular-skills/workflows/shaping-checklist.md) and fix every failing check.

## Format and Conventions

- Point to `building-modular-skills` for the full layout and rule set; do not duplicate them here.
- Frontmatter fields: `name`, `description` (trigger-rich, folded), `license: MIT`, `compatibility: Universal`, and `metadata`.

## Verify

- Run `python3 .agents/skills/building-modular-skills/scripts/validate_md_links.py` on the skill tree and fix any broken relative link it reports.
- Run the shaping checklist from `building-modular-skills` and fix every failing check.

## Apply and Restart

- The skills-loader plugin injects skills at server start.
- Ask for an opencode restart so the skill loads for the next session.
