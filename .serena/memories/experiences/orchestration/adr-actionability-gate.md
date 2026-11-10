---
id: experiences/orchestration/adr-actionability-gate
type: experiences
L0: "A decision record needs a second verdict axis: a separate reader asking 'could an implementer act on this sentence alone'; absence claims cite the surface that enumerates the fact, and every open parameter gets a decision plus rationale"
hotness: 0.8
ttl: 180d
version: 1
freshness: 2026-10-28
directory: experiences/orchestration
provenance: "Orchestration run 2026-10-28 refining an accepted ADR; no child failed. Four orchestrator observations O1-O4. Sibling mem:experiences/orchestration/adr-rework-budget-and-citation-discipline covers the budget and citation failures of the same run; this entry covers the review-axis and underdetermination failures."
---
# A decision record can be true, pass review, and still be unimplementable

A refinement with no failed child produced a record that scored 10/10 on a correctness judge and was accepted. A separate child asked whether an implementer could act on each sentence alone and returned 10 gaps. Three of those gaps were not research questions but decisions the record had silently delegated to its implementer.

## Rules

1. **Gate acceptance on an actionability reader, not on the correctness score.** A reader whose only question is "could an implementer act on this sentence alone" found 10 gaps in a record that a 10/10 correctness judge had passed.
2. **Treat correctness and actionability as two independent verdicts.** A criteria score is evidence of truth only; no number on one axis implies anything about the other.
3. **Give every parameter the implementer would otherwise choose a written decision plus rationale.** An unresolved choice (id policy, dedupe strength under an unknown storage medium, a size ceiling) reads as design content and is counted as a gap only when a reader is asked to implement it.
4. **Establish a negative claim only against the surface it names.** Cite the doc or section that enumerates the surface and the search over it that came back empty; a grep of one directory cannot prove that a signal does not exist in the API.
5. **Enumerate the decisions implementation needs, then diff them against the record's stated decisions.** Each missing one closes by adding a decision line, never by an implementer default.
6. **When a report and its artifact disagree, the artifact wins.** Unrelated opening material in a report is a defect of the report, not of the deliverable.

## Root causes

- Absence claims carried no evidence standard: "the signal does not exist" feels like it asserts nothing, so the search scope stayed whatever the child picked, while the claim was scoped to the whole API surface.
- One verdict answered two questions: acceptance criteria were written from the record's internal consistency, and no reviewer's sole job was doability, so self-consistency stood in for implementability.
- Open choices look like content: an unresolved parameter is formatted like a design note, so no criterion counted it as missing.
- Deliverable ownership was unstated: the child owned an artifact, but its report was read as the handover.

## Verification

Source: the four orchestrator observations of the 2026-10-28 run. O1 was confirmed against .opencode/instructions/opencode-plugin-interfaces.instructions.md:96, where session.hook accepts compaction among its hook names. Rules 1-3 rest on O2 and O4 (10 gaps, 3 of them deferred decisions); rules 4 rests on O1; rule 6 restates rule 3 of the sibling memory as a check rather than a new cause.

## Scope rationale

scope: experiences — several distinct failure classes in one run, cross-child, not one failure plus one fix. Rules 4 and 6 are single observations at confidence 0.7; rules 1-3 and 5 rest on O2/O4 and are confidence 0.8. Not merged into the sibling because the combined body would exceed the 4000c minimal gate; the two are cross-linked instead.