---
id: cases/orchestration/artifact-not-run-against-own-gates
type: cases
L0: "A design failed its first fresh critique on five self-consistency defects: a gate unsatisfiable under its own exception, a re-entry voiding nothing, a ledger off by 4, six gate rows with no firing stage, an unfirable example."
hotness: 0.5
ttl: 180d
version: 1
freshness: 2026-11-21
directory: cases/orchestration
status: superseded
superseded-by: cases/orchestration/spec-gates-unchecked-for-satisfiability
confidence: 0.9
provenance: "Orchestrator run record of the 2026-11-21 aidlc research run; F9; the fresh critique verdict listing all five defects"
---
> **Superseded by mem:cases/orchestration/spec-gates-unchecked-for-satisfiability.** Read that case for the lesson and the fix report naming each repair; this body is kept for audit only and must not be followed as guidance.

# The artifact was never run against its own rules

## Symptom
A design document failed its first fresh critique with five defects, all internal: a blocking gate demanding 100% sentence-to-claim traceability while section 3.1 permitted INFERENCE sentences, so the gate could not pass; a middle loop whose re-entry voided nothing and shared the capped budget; a drop ledger whose rows missed four stages (33-16 is not 17); six gate rows with no firing stage; a guardrail example that could not fire on the stage it cited.

## False hypothesis
That fresh critique exists to show a writer what they cannot see, so the design author shipped to critique before any self-run, believing that order saves a pass.

## Root cause
The design author wrote the document's rules as independent sections and never executed them against each other. The design author ran no closed-world pass that asked, per gate, whether the exceptions the same document grants make it unsatisfiable; per ledger, whether the rows sum to the source total; per rule, which stage fires it; per example, whether it runs on the stage it names. The first fresh critique was therefore the first executor of the document's own logic, and it found only what one internal pass would have found.

## How confirmed
Each defect is decidable from the document alone, with no external evidence: the traceability gate and the INFERENCE allowance cannot both hold; 33 minus 16 is 17 and the ledger dropped four stages; six gate rows name no stage; the cited stage cannot trigger the example. A fresh reader reproduced all five without the design author's reasoning.

## Prevention
- Before external critique, the design author runs the document's own invariants: pairs every blocking gate with the exception that could make it unsatisfiable; sums every ledger against its source total; gives every gate row a firing stage id that exists; runs every example against the stage it cites.
- The design author fixes gate/exception pairs first; an unsatisfiable gate invalidates every pass downstream of it.

Related: mem:cases/orchestration/prompt-rule-contradicted-by-own-examples, mem:cases/orchestration/self-graded-count-mismatch
