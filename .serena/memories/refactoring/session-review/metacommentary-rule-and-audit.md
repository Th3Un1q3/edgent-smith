# Metacommentary Rule and Audit

Skill/instruction/command docs contain their content, not their biography. Forbid self-referential placement/provenance claims ("this lives here", "the policy lives here in one place", "the single source of truth" as a process note), plan/process provenance ("per plan Step N"), and commentary on a document's own design choices. Discriminating question per sentence: does it tell the reader something they can act on? Cross-references by name, scope statements, and doctrine naming components are content, not metacommentary.

## Rule location

Canonical guidelines "No Metacommentary" + "Act on Content" in `.opencode/instructions/writing-style.instructions.md`.

## Audit (165 .md files: 147 skills + 12 instructions + 6 commands)

- 5 confirmed same-class hits, all in context-gathering reference-file intros (content-fetch-api.md, serena-memory-api.md, filesystem-server-api.md, memory-management-checklist.md, snippets.md) — all fixed (deleted/reworded).
- session-analysis.md policy-location meta phrasing reworded (directive kept).
- Not fixed (deliberate): session-analysis.md "ONLY jq" editor-guard, extending_scripts.md "per plan §9", schema.md actionable limitation, edge-architect-workflows SKILL.md routes-reader line, trivial "(see below)" locators.

## Lesson: plan-parameter prose drift

A plan that defines only parameters (location, defaults) and not prose pushes subagents to compose connective text, which drifts into process/provenance meta-chatter — and meta-commentary in skill docs reads as nonsense. Root cause: the prompt relayed the plan mandate; the plan mandated location/content; the agent composed the prose. Mitigation: write doctrine directly in the plan, or vet composed prose with the "Act on Content" question.

Related: mem:refactoring/session-review/command-evidence-spine.