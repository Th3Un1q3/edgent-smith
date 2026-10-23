---
id: researches/audits/sweep
type: researches
L0: "# Genre-narration sweep — docs tree (read-only)"
---
# Genre-narration sweep — docs tree (read-only)

Scope: AGENTS.md, .opencode/instructions/ (21 files), .agents/skills/ (root SKILL.md + grep hits), docs/plan/.
Method: mechanical grep for the 12 phrases, then reading the instruction files and AGENTS.md to separate defect from content.
Mechanical hit counts (raw, before triage):
- .opencode/instructions: 1 (writing-instructions.instructions.md:37 — false positive, checklist question)
- .agents/skills: 37 (mostly false: automa evals.json prompt text "no longer remember", "engine no longer holds", "failure no longer reproduces", "recorded fallbacks")
- AGENTS.md: 2 (117 genuine, 124 false: imperative "must be moved")
- docs/plan: 16 (mostly false: runtime "no longer treats", "no longer exists", superseded-step notes)
Genuine findings: 20 (below). Best surviving rule stated per item; "no rule lost" means the clause can be deleted whole.

## AGENTS.md (read every session — highest encounter rate)
1. AGENTS.md:117 — "serena-gateway.instructions.md is a guard that only routes edits." Cost: reader learns the file's genre twice over (frontmatter already says it). Delete: no rule lost; the gateway-protocol path in the same sentence stays.
2. AGENTS.md:189 — "This document shows only OpenCode and DSH loading skills - never claim skill support for GitHub Copilot, Conductor, or System A." Cost: the sentence starts by describing the document. Delete first clause; MUST SURVIVE: never claim skill support for Copilot, Conductor, or System A.
3. AGENTS.md:129 — "Instruction Files as Code: Detailed development guidelines are codified in .opencode/instructions/*.md for strict compliance check by agents and contributors." Cost: no action, only a claim about the docs system. Delete: no rule lost.
4. AGENTS.md:10 — "Use this world model to effectively navigate any task." Cost: an instruction about the diagram, not the repo. Delete: no rule lost; the diagram stays.
5. AGENTS.md:3 — "Generated: 2026-06-20" (with Last verified: 2026-09-21). Cost: provenance the reader cannot act on. Delete: no rule lost; the freshness signal (re-verify before trusting) would need one plain line if wanted.
6. AGENTS.md:95 — "The system is architected around high-centrality components in the following modules:" Cost: bridging filler before a table. Delete: no rule lost.

## .opencode/instructions (loaded by scope)
7. serena-gateway.instructions.md:3 — description: "routes to the serena-memory skill that owns the gateway protocol instead of restating it." Cost: loader-visible text describes routing, not the trigger. Delete clause; MUST SURVIVE: load on edits to gateway-using skills (applyTo already encodes it).
8. serena-gateway.instructions.md:9 — "The gateway protocol is owned by the serena-memory skill and must not be restated here." Cost: duplicate of AGENTS.md:117. Delete: the real rules (cite mem:, never read .serena directly) are lines 11-13; nothing lost.
9. serena-gateway.instructions.md:14 — "A gateway call made outside an edit is the skill's job, not this instruction's." Cost: file-ownership trivia. Delete: no rule lost (serena-memory already triggers on calls).
10. opencode-plugin-interfaces.instructions.md:125 — "This file covers unit-level proof only; the delegated run in the section below is where a live check belongs." Cost: scope disclaimer where a rule belongs. Delete clause; MUST SURVIVE: green unit tests do not prove live behavior (line 123 says it).
11. zombie-test-design.instructions.md:10 — "The ZOMBIES mnemonic, its ordering, and the case-by-case workflow are owned by the test-driven-development skill in references/zombie-test-design.md." Cost: ownership parsing before the load directive. Delete ownership clause; MUST SURVIVE: load that reference.
12. tdd-enforcement.instructions.md:11 — "The Iron Law, the RED → GREEN → REFACTOR cycle, the rollback sequence, and the completion checklist are owned by the test-driven-development skill; load SKILL.md." Same cost. Keep "load SKILL.md"; ownership clause deletable.
13. shaping.instructions.md:9 — "Skill shaping is owned by the building-modular-skills skill: budgets in ..., the audit command in ...". Cost: three-hop routing sentence. Delete framing; MUST SURVIVE: the three file pointers.
14. typescript-test-best-practices.instructions.md:10 — "Test design criteria and the TypeScript conventions for mocking, assertions, and test structure are owned by the test-design skill." Cost: same. Keep the pointers; drop the ownership preface.
15. storage-selection.instructions.md:9 — "The ordered store test and the memory topic table are owned by ## STORAGE SELECTION." Cost: tells the reader the fact lives elsewhere and then restates nothing. Keep the anchor link; the ownership framing can go.
16. harness-verify.instructions.md:14 — "Topology and scripts/conductor/ scaffolding rules are owned by ...; run just verify-agents." Keep the command; the ownership clause is deletable.
17. comments.instructions.md:29 — "Cleanup rule: the deletion obligation for commented-out code and debug artifacts, owned by test-driven-development." Keep the pointer; ownership tag adds nothing.
18. opencode-plugin-interfaces.instructions.md:159 — "The rule that a rejected name is a report about the design, and the Decide-and-Act split, are owned by the refactoring-patterns skill in references/..." Keep pointer; drop the ownership frame.

## docs/plan (read only by implementers, lowest rate)
19. docs/plan/2026-10-21-instructions-loader-adr-011-delta/migration-plan.md:5 — "Scope: planning artifact only. No source file is changed by this document." MUST SURVIVE the boundary (plan-only, no code change) as a plain imperative.
20. docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md:5 — "Scope: planning artifact only. The migration is not implemented by this document." Same verdict.

## Explicit false positives (checked, not counted)
- comments.instructions.md:116 — the "previously defined ... moved here" line is a quoted anti-pattern example inside the section forbidding it.
- AGENTS.md:124 — "must be moved to cli/services/" is a rule, not history.
- writing-instructions.instructions.md:37 — "is a pointer enough?" is a checklist question.
- .agents/skills hit majority — runtime behavior ("engine no longer holds a tab"), eval prompt prose, and "recorded fallbacks" extraction content.
- context-gathering/SKILL.md:15,121 — "code mode no longer recommended" is a deprecation advisory that changes behavior; held out of the defect list.

## Provenance
Source: grep over the four areas plus reads of AGENTS.md, all 21 instruction files' hit regions, serena-gateway, opencode-plugin-interfaces, writing-style, and docs/plan hit regions. Read-only; zero edits.