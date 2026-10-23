---
name: writing-instructions
description: "Follow it when: adding, editing, or reviewing an instruction file, an agent definition, a prompt file, or a skill body. Defines what an instruction is, the measurable-rule test every rule line must pass, and where each kind of content belongs before you write one."
applyTo: "{.opencode/instructions/**/*.md,.opencode/agents/**/*.md,.github/agents/*.agent.md,.github/prompts/**/*.md,.agents/skills/**/*.md}"
---

# Writing Instructions

An instruction is edit-time guidance that an agent loads automatically when it touches files matching `applyTo`. It exists to make edits to those file types better: fewer wrong paths, fewer invented conventions, fewer corrections. Loading is triggered by path, not by intent, so the file must pay for itself during an edit of the files it matches.

## What it is not

- Not a skill: it carries no procedure and no workflow of its own.
- Not a second copy of a skill: it never restates steps a skill already owns.
- Not repo-wide or session-wide policy: that binds every task, not one file type.
- Not a tutorial: the reader is mid-edit, not studying a subject.
- Not a record: no provenance, history, dates, or changelog.
- Not a description of a document: state the rule and name the pointer target; never say what kind of document this file or another file is.

## Where content goes

Placement rules: `.agents/skills/harness-management/`; it owns them.
Content that is not about editing the matched files does not belong here.

## Pointer pattern

When a skill owns the procedure, name the skill file and stop. One or two lines, never a summary of its steps:

```markdown
Run expansions through the `context-gathering` skill; it owns the procedure.
```

## Measurable rules

### The test

A rule either names the unit it counts, the threshold it compares against, the observable it checks, or the branch it chooses; a line that names none of these is a preference and must be deleted or made measurable.

### Banned forms

| Form | Example | Defect to fix |
|---|---|---|
| Virtue slogan | "size the task, not the ambition" | States an intention; names no unit, threshold, observable, or branch. |
| Unquantified comparative | "split large subtasks and keep the budget realistic" | "large" and "realistic" compare against no number a reader can check. |
| Metaphor carrying the rule | "keep the blast radius inside the child's budget" | "blast radius" is a name. Name the number the limit uses; if that number appears nowhere in the file, add the sentence that sets it. |
| Triple negation | "do not fail to avoid skipping the ledger" | Three negatives, no condition and no action; state the action and the branch that triggers it. |
| Document self-description | "this section establishes the sizing principle" | Describes the text, not the reader's action; replace it with the action or delete it. |

### Required form

Before: "size the task, not the ambition"

After: "one deliverable per subtask; split when setup would consume more than a quarter of the child's budget."

Judge the replacement with the same four cells: count one deliverable per subtask, compare setup cost against a quarter of the child's budget, and split when setup exceeds that threshold.

### Check before shipping

Write one ledger row per rule line before delivering rule text:

| Line | Unit counted | Threshold compared | Observable checked | Branch chosen |
|---|---|---|---|---|
|  |  |  |  |  |

Mark a cell `none` when the line names nothing for it. Delete every line whose four cells are all `none` before the text is delivered. A reviewer of such text judges the ledger, not the prose: a line with four `none` cells is rejected and returned for rewrite even when the prose reads well.

A ledger written by the author of the text is not evidence of that text's compliance. The ledger is applied to the delivered text by a reader who did not write it, and every cell quotes the exact token from the line that earns it; a cell with no quoted token counts as `none`.

### Routing

Before writing an instruction, prompt, or rule, load the `unslop` skill and follow it, then read this file and `writing-style.instructions.md`; if the text will be loaded by an agent, read `shaping.instructions.md` as well.

### Scope

Apply this file to agent definitions (`.opencode/agents/**/*.md`, `.github/agents/*.agent.md`), instruction files (`.opencode/instructions/**/*.md`), prompt files (`.github/prompts/**/*.md`), and skill bodies (`.agents/skills/**/*.md`). Skip runtime code, tests, CI configuration, commit messages, and README and design prose; route that prose through the `unslop` skill for surface mechanics and `writing-style.instructions.md` for document voice, while this file decides whether a line is a rule.

## Before adding or editing an instruction

1. Does `applyTo` match exactly the files this helps, no wider and no narrower?
2. Would an agent editing those files otherwise get it wrong?
3. Is every line about editing those files, not about process?
4. Does a skill already own this, and if so, is a pointer enough?
5. Does anything here duplicate `AGENTS.md`?
6. Would deleting this file change any behaviour?
7. Has every rule line produced a ledger row with at least one cell other than `none`?

## Placement and style

Placement rules: `.agents/skills/harness-management/`. Document style: `.agents/skills/building-modular-skills/`.
