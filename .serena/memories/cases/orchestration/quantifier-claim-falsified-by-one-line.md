---
id: cases/orchestration/quantifier-claim-falsified-by-one-line
type: cases
L0: "Absolute framing (no X exists, the only effect, two wired effects) was falsified three times, each by one line never enumerated; counting words asserted a set nobody closed."
hotness: 0.6
ttl: 365d
version: 1
freshness: 2026-11-15
directory: cases/orchestration
status: active
provenance: orchestration run 2026-11-15 authoring a design-contract document, 7 judge rounds; producer interview
related: mem:cases/orchestration/self-graded-count-mismatch
---
# A quantifier word over a set that was never closed

## Symptom
Three absolute statements in the design contract were falsified, each by a single line: "no X exists", "the only effect", and "two wired effects". In every case the counter-example was one line of source the producer had not enumerated.

## False hypothesis
Each falsification was a separate defect in a separate sentence, so the fix was to correct that sentence and re-run the judge.

## Root cause
Counting and absolute words — no, only, two — asserted that an enumeration was exhaustive. The writer performed no enumeration, so the claim's truth depended on a set it had never closed. Each round falsified one quantifier with one line, and the corrected sentence introduced the next quantifier, because the framing habit survived the sentence-level fix.

## How confirmed
For each of the three failures the counter-example was a single line outside the writer's stated set. Replacing the quantifier with an exhaustive enumeration of the set removed the whole class: no quantifier claim failed in any later round, while earlier sentence-level corrections had only moved the failure.

## Prevention
A quantifier word obliges the writer to print the enumerated set and its count beside the claim. When the set cannot be closed, name the actual subset and its boundary ("the two effects this plugin wires", "the paths this run touched") and never "the only" or "no X exists". Judge rounds read the enumeration, not the quantifier.