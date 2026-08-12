# Multi-File Edits: Rightsized Per-File Subagents, Start Editing Immediately

Decompose multi-file editing tasks into one subagent per file group and instruct each subagent to START EDITING after a single read pass - no exhaustive planning first. Planning consumes the subagent context budget before any edit lands. Source: observed 2026-08-12 building-modular-skills cleanup session.

## Failure: monolithic planning subagents return EMPTY

Two attempts ran a 5-file cleanup as ONE subagent. Both read all 5 files (~556 lines), built detailed edit plans, then exhausted their context budget during planning and returned empty results with zero edits. RUG-style resume/status confirmed 0% implementation each time. The empty return reads as a success at the orchestrator level, so it passes unnoticed.

## Fix: rightsized decomposition + immediate editing

- One subagent per file group (1-2 files each): 3 subagents replaced 1 monolithic one (guidance.md; shaping-checklist.md; SKILL.md + authoring-workflow.md + templates.md).
- Prompt each subagent to read its files once then begin editing immediately - elaborate planning killed the budget pre-edit.
- Completed the same cleanup with no silent failures.

Related: mem:subagent-workflows/prompt-discipline (micro-task decomposition at the prompt level - this is its multi-file editing instance); mem:subagent-workflows/parallel-edits-cross-file-references (when per-file subagents run in parallel, declare cross-file anchors centrally).