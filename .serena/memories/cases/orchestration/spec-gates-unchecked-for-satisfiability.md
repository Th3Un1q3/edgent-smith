---
id: cases/orchestration/spec-gates-unchecked-for-satisfiability
type: cases
scope: orchestration
status: active
confidence: 0.9
date: 2026-11-21
freshness: 2026-11-21
hotness: 0.6
ttl: 180d
provenance: "Fresh-critique and fix reports, 2026-11-21 AIDLC research retrospective"
L0: "The design failed its first fresh critique with five defects - an unsatisfiable gate, a void loop re-entry, a 33-16=17 ledger, six gate rows with no firing stage, a guardrail that cannot fire - because no step read two parts of the document together."
---

# Spec gates never checked for satisfiability or coverage

## Symptom
The design failed its first fresh critique with five defects: a blocking gate demanding 100% sentence-to-claim tracing while section 3.1 permitted INFERENCE sentences; a middle loop whose re-entry voided nothing and shared the capped budget; a drop ledger whose arithmetic missed four stages (33 minus 16, listed as 17); six gate rows with no firing stage; and a guardrail example that could not fire on the stage it cited.

## False hypothesis
A design is ready for critique once every section exists, and structural inconsistency is what a critic is for.

## Root cause
No checker executed the artifact rules against each other. Nothing summed the ledger, crossed each gate row with a named firing stage, or tested each gate predicate against the artifact own permitted cases. Every defect is a relation between two parts of the document, and no step read two parts together, so an unsatisfiable gate, six unowned gate rows, a void loop and a non-firing guardrail all read as complete prose.

## How confirmed
The critique report lists the five defects. The fix report names each repair: the ledger was re-summed to account for the four stages, gate rows were anchored to firing stages, the gate predicate was relaxed to admit INFERENCE sentences, and the guardrail example was moved to a stage where it fires.

## Prevention
Before critique, run the artifact own numbers as a table: sum every ledger and compare it with the stage count; list every gate with the stage that fires it, where a blank firing stage is a defect; test every predicate against the cases the artifact permits. A design that cannot be counted has not been checked.

Related: mem:cases/criterion-universal-unmeasured, mem:cases/orchestration/quantifier-claim-falsified-by-one-line

Supersedes: mem:cases/orchestration/artifact-not-run-against-own-gates - same five defects, written the same day from the run record without the fix report; kept for audit at status superseded.