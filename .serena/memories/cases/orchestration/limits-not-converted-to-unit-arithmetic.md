---
id: cases/orchestration/limits-not-converted-to-unit-arithmetic
type: cases
L0: "A 24-call child was asked to open 41 entries; another closed at 26/24; two memories ran 8-11k against a 4k L1. Every limit was stated, none divided into units before the work."
hotness: 0.5
ttl: 180d
version: 1
freshness: 2026-11-21
directory: cases/orchestration
status: active
confidence: 0.9
provenance: "Orchestrator run record of the 2026-11-21 aidlc research run; F3, F8, F13; child interview question 2 and the retrospective child spend line"
---
# Limits stated, never divided into units

## Symptom
Three sizing failures in one run. The dispatch author told a child to open every top-level entry of a repository - 33 bodies plus 8 directories - inside a 24-call budget. The retrospective child closed with "spend: 26 / 24". The memory author promoted two memories at 8-11k chars against the ~4k L1 disclosure budget, so an L1 recall returns an excerpt.

## False hypothesis
That stating a limit in a prompt enforces it: that "24 calls" or "4k L1" is a constraint the worker feels while working, so naming the number is enough.

## Root cause
The limit existed only as a number in a prompt or a reference, never as arithmetic over the work. The dispatch author sized the dispatch by the deliverable it wanted and left the division to the child; the dispatch author computed no cost per unit (one call per opened body, plus setup and the closing report) and gave neither the child nor itself a running counter with a stop rule. The same shape at authoring: the memory author knew the 4k L1 budget and never checked it against the body being written.

## How confirmed
41 units against 24 calls leaves under one call per unit including setup and the report, so the dispatch was unwinnable by arithmetic before it started. The child's own spend line read 26/24, the overrun visible in the closure it never reached. The memory author wrote both bodies at 8-11k chars against the 4k budget in references/disclosure.md.

## Prevention
- Before dispatch, the dispatch author divides: (calls available - 3 reserved for verification and closing) / unit count, and cuts scope or raises the budget when the quotient cannot cover one unit.
- The dispatch author puts the stop rule in the prompt, not only the total: "stop opening at call N-3 and write the report".
- At authoring, the memory author measures the body with a byte counter against the L1 4000c cap, frontmatter included.

Related: mem:cases/orchestration/self-graded-count-mismatch, mem:cases/orchestration/unverified-length-from-stacked-edits, mem:cases/shell-denied-in-subtask
