# Create Scoped Instructions

Use this workflow to write or update a file-type instruction under `.opencode/instructions/` that an agent follows whenever it edits matching files.

## When to Use This Change Type

Use this change type when:
- You want to improve the quality or accuracy of editing a specific file type: markdown, code, or config.
- You want the guidance applied automatically when an agent touches those files.
- The guidance stays scoped to a file type rather than a whole process.

## Decide: Is This the Right Change Type?

- Guidance about a whole process or workflow belongs in a skill — see [manage-skill.md](./manage-skill.md).
- opencode config mechanics belong to `customize-opencode` (built-in) — reference it by name; it has no on-disk files in this repo.

## Procedure

1. Identify the file type(s) and the specific mistakes the guidance must prevent.
2. Create `.opencode/instructions/<name>.instructions.md`.
3. Model the structure on an existing instruction file. Read `writing-style.instructions.md` or `tdd-enforcement.instructions.md` for the house format: `# Title`, `## Guidelines`, `## Step-by-Step Workflow`, `## Output Format`.
4. If the instructions-loader plugin surfaces the guidance through `<steering />` messages, follow the schema documented in `.opencode/instructions/steering-message.md`.

## Format and Conventions

- Name the file `<name>.instructions.md` — for example `writing-style.instructions.md`.
- Plain markdown. Keep any frontmatter to loader-scoping metadata (`applyTo`, `excludePaths`) as `tdd-enforcement.instructions.md` does.
- Write guidance as directives an agent can follow: imperative verbs, concrete commands, named anti-patterns.
- Keep the file scoped to one file type; move process guidance to a skill.

## Verify

- Read the file as a fresh agent would, with no other context.
- Confirm the section headings match sibling instruction files in `.opencode/instructions/`.
- Confirm every path and command cited exists on disk.

## Apply and Restart

- The instructions-loader reads instruction files at server start.
- Ask for an opencode restart to apply the new instruction.
