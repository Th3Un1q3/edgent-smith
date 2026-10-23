---
id: preferences/rules_authorship_requires_writing_instructions
type: preferences
L0: "Rule text needs retrieval before authorship: read writing-instructions, writing-style, shaping; then test unit, threshold, observable, branch."
hotness: 0.6
ttl: 90d
freshness: 2026-10-23
provenance: .opencode/instructions/writing-instructions.instructions.md; rejected edit to .opencode/agents/rug.md
---
# Retrieval before authorship of rule text

## Rule

Before writing rule text in this repo — an agent definition, instruction file, prompt, or skill body — read `.opencode/instructions/writing-instructions.instructions.md`, `writing-style.instructions.md`, and `shaping.instructions.md`. Then test every rule line on four cells: unit counted, threshold compared, observable checked, branch chosen. A line whose four cells are all `none` is a preference; delete it or quantify it before delivery.

## Evidence

2026-10-23: a section was added to `.opencode/agents/rug.md` without reading any of the three files. It contained "size the task, not the ambition". It survived two existing checks — a duplication check (no other file said it) and a contradiction check (it conflicted with nothing) — because neither check tests whether a dispatcher can execute a line. The reviewer caught it by asking for unit, threshold, observable, branch; the slogan named none.

## Countermeasure in force

`writing-instructions.instructions.md` § Measurable rules states the four-cell test, lists "Virtue slogan" as a banned form with this exact example, gives the before/after replacement, and requires a ledger row per rule line with all-`none` rows deleted. Its § Routing sentence sends an author to these files first.

Related: mem:skills/general/convention-discovery-precedes-prompt covers a delegated child's discovery step, not the author's.

Source: writing-instructions.instructions.md § Measurable rules and § Routing; observed authoring failure on .opencode/agents/rug.md, reviewed 2026-10-23.
