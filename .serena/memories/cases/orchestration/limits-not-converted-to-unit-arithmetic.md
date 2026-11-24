---
id: cases/orchestration/limits-not-converted-to-unit-arithmetic
type: cases
L0: "A 24-call child was asked to open 41 entries; another closed at 26/24; two memories ran 8-11k against a 4k L1; a brief asked one prompt block per token against a 4500c body cap. Every limit was stated, none divided into units."
hotness: 0.55
ttl: 180d
version: 2
freshness: 2026-11-24
directory: cases/orchestration
status: active
confidence: 0.9
provenance: "Orchestrator run record of the 2026-11-21 aidlc research run; F3, F8, F13; child interview question 2 and the retrospective child spend line; memory-proposal run record, 2026-11-24"
---
# Limits stated, never divided into units

## Symptom
Four sizing failures in two runs. The dispatch author told a child to open every top-level entry of a repository - 33 bodies plus 8 directories - inside a 24-call budget; the retrospective child closed with "spend: 26 / 24". The memory author promoted two memories at 8-11k chars against the ~4k L1 disclosure budget, so an L1 recall returns an excerpt. A validation brief then asked for one full prompt block per shorthand token while the memory body cap allowed 4500 characters, and the writer spent two repair rounds on a shape the two requirements could not both admit.

## False hypothesis
That stating a limit in a prompt enforces it: that "24 calls", "4k L1" or "4500 characters" is a constraint the worker feels while working, so naming the number is enough.

## Root cause
The limit existed only as a number in a prompt or a reference, never as arithmetic over the work. The dispatch author sized the dispatch by the deliverable it wanted and left the division to the child; it computed no cost per unit (one call per opened body, plus setup and the closing report) and gave neither the child nor itself a running counter with a stop rule. The same shape at authoring: the memory author knew the 4k L1 budget and never checked it against the body being written. The fourth failure is the same gap between two stated numbers: the validation brief set a per-item output rule and a body cap and never divided block size into the cap, so once the tokens outgrew it no compliant output existed.

## How confirmed
41 units against 24 calls leaves under one call per unit including setup and the report, so the dispatch was unwinnable by arithmetic before it started. The child's own spend line read 26/24. The memory author wrote both bodies at 8-11k chars against the 4k budget in references/disclosure.md. The two repair rounds on the token-per-block criterion confirmed the fourth: no edit closed the gap, because none could.

## Prevention
- Before dispatch, the dispatch author divides: (calls available - 3 reserved for verification and closing) / unit count, and cuts scope or raises the budget when the quotient cannot cover one unit.
- The dispatch author puts the stop rule in the prompt, not only the total: "stop opening at call N-3 and write the report".
- At authoring, the memory author measures the body with a byte counter against the L1 4000c cap, frontmatter included.
- When a brief carries both a per-item output form and a size cap, the dispatch author names which governs and writes the criterion against it: the cap governs, and the criterion asks for the reduced form the cap admits.

Related: mem:cases/orchestration/self-graded-count-mismatch, mem:cases/orchestration/unverified-length-from-stacked-edits, mem:cases/shell-denied-in-subtask
