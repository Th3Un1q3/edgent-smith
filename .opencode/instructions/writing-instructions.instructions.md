---
name: writing-instructions
description: "Follow it when: adding, editing, or reviewing an instruction file in .opencode/instructions/. Defines what an instruction is, what it is not, and where each kind of content belongs before you write one."
applyTo: ".opencode/instructions/**/*.md"
---

# Writing Instructions

An instruction is edit-time guidance that an agent loads automatically when it touches files matching `applyTo`. It exists to make edits to those file types better: fewer wrong paths, fewer invented conventions, fewer corrections. Loading is triggered by path, not by intent, so the file must pay for itself during an edit of the files it matches.

## What it is not

- Not a skill: it carries no procedure and no workflow of its own.
- Not a second copy of a skill: it never restates steps a skill already owns.
- Not repo-wide or session-wide policy: that binds every task, not one file type.
- Not a tutorial: the reader is mid-edit, not studying a subject.
- Not a record: no provenance, history, dates, or changelog.

## Where content goes

Placement rules: `.agents/skills/harness-management/`; it owns them.
Content that is not about editing the matched files does not belong here.

## Pointer pattern

When a skill owns the procedure, name the skill file and stop. One or two lines, never a summary of its steps:

```markdown
Run expansions through the `context-gathering` skill; it owns the procedure.
```

## Before adding or editing an instruction

1. Does `applyTo` match exactly the files this helps, no wider and no narrower?
2. Would an agent editing those files otherwise get it wrong?
3. Is every line about editing those files, not about process?
4. Does a skill already own this, and if so, is a pointer enough?
5. Does anything here duplicate `AGENTS.md`?
6. Would deleting this file change any behaviour?

## Placement and style

Placement rules: `.agents/skills/harness-management/`. Document style: `.agents/skills/building-modular-skills/`.
