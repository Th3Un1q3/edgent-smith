# Building-Modular-Skills: Redundancy Fixed by Pointing, Not Merging

Compaction pass (v3.4.0, 2026-08-12) on the building-modular-skills meta-skill. The guidance<->checklist split is load-bearing - see mem:skills/general/building-modular-skills-contradiction-resolution for the v3.1.0 baseline (13 items); the count has since grown to 16 rules in references/guidance.md and 16 checks in workflows/shaping-checklist.md, and the 1:1 mapping with preserved rule numbering is the invariant, not the count.

## The compaction approach

- guidance.md teaches WHY (16 rules, each with rationale and audit method); shaping-checklist.md verifies WHAT (16 falsifiable Run commands). Consumed at different phases: guidance at authoring time, checklist at completion.
- Redundancy between them was a PROSE problem: the checklist restated rules and the mapping table duplicated per-rule pointers. Fix = pointing (checklist refers to the rules; mapping table points), NOT merging the files - merging would break the phase-split design.
- Invariants that must never break: 16:16 one-to-one mapping, rule numbering.

Related: mem:skills/general/validate-md-links-script (validate_md_links.py wired into the v3.4.0 routing table).

## Pointer mechanics (context-gathering workflow rework, 2026-08-13)

Workflow files hold the procedure; reference files hold the facts. Point, don't restate, using:
- Numbered-entry references — `(devtools-known-issues #N)`: the reference's numbered list is canonical; the workflow cites the number, never the fact.
- Section anchors — `[truncation-examples §A](../references/truncation-examples.md)`: anchor symbols name stable reference sections, so pointers survive edits.
- The workflow restates only the procedure decision; every fact it needs is one pointer away.