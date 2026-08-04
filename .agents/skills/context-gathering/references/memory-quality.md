# Memory Quality Checklist

Before storing a memory via `write_memory`, validate it against these criteria. Reject memories that fail any check.

## Quality Criteria

### 1. Systematic

Would this help an agent approach a **similar task in the future**? If it only applies to the current session or a one-off task, skip it.

- **Pass**: A checklist for leaving an apartment: "Turn off lights, shut down water, ensure electrical equipment is off (except fridge)."
- **Fail**: "Turn off light in the kitchen by switching power switch on the wall next to the door." — Too specific to one location; won't transfer.

For project memories: good memories describe patterns, conventions, and decision rationales that remain useful across multiple sessions. Bad memories describe session-specific state or one-time fixes.

### 2. Right Abstraction Level

Is it specific enough to be useful, but not so specific it duplicates source code or becomes stale when code changes?

- **Pass**: "OpenCode plugins use a state model with accumulated step counts persisted to SessionStorage under a namespaced key, with hooks that read/modify/persist via readState/updateState." — Reusable pattern, survives code changes.
- **Fail**: "The skill-usage-tracker plugin's `countStep` function at line 151 increments `stepCount` by 1." — Duplicates source code, breaks when line numbers shift.

Think: **checklist, not step-by-step recipe for one specific file.** If the memory mentions specific line numbers, exact function signatures, or file paths that could change, raise the abstraction level.

### 3. Non-Redundant

Does this knowledge already exist in the project's skills, source comments, READMEs, AGENTS.md, or existing memories? If yes, do not store it.

- Check `list_memories({})` for existing domains covering the same topic.
- Check the project's AGENTS.md, README.md, and instruction files for overlapping documentation.
- Check source code comments and docstrings for documented patterns.

### 4. Concise

Max 2–3 paragraphs. Use bullet lists. Cross-reference with `mem:` rather than duplicating.

- Link to related memories instead of repeating their content.
- Use tables for structured information (pros/cons, configurations, phases).
- If a memory grows beyond 2-3 paragraphs, split it into sub-topics under the same domain.

## Negative Examples (Project Context)

These are real examples of what NOT to store:

- **Too granular**: "The skill-usage-tracker plugin's `countStep` function at line 151 increments `stepCount` by 1" — duplicates source code, line numbers will stale.
- **Session-specific**: "During today's refactoring, we moved the `getSessionAgent` helper from `session-tracker.ts` to `helpers/session.ts`" — describes a one-time change, not a reusable pattern.
- **Already documented**: "Python 3.13 uses `from __future__ import annotations`" — already in AGENTS.md and conventions domain.

## Pre-Store Checklist

Run through this checklist before every `write_memory` call:

- [ ] Can an agent reuse this knowledge for a future, different task?
- [ ] Is it at the right level of abstraction — no line numbers, no exact file paths?
- [ ] Does it duplicate existing documentation elsewhere?
- [ ] Is it under 3 paragraphs? Uses `mem:` references instead of duplication?
