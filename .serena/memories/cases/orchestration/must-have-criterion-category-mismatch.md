---
id: cases/orchestration/must-have-criterion-category-mismatch
type: cases
L0: "Must-have criteria without a category-anchored acceptance test let a writer score a diagram tool against state-machine-library expectations and record three false FAILs."
hotness: 0.5
ttl: 180d
version: 1
freshness: 2026-11-10
directory: cases/orchestration
provenance: orchestrator retrospective 2026-11-10
---
# Must-have criterion without a category anchor

## Symptom
In the 2026-11-10 research run, the writer's first document scored state-machine-cat as failing all three must-have criteria; a fresh validator reading the same source scored it PASS, because as a diagram tool it meets all three.

## False hypothesis
The candidate genuinely lacked all three must-haves. The writer's ledger was internally consistent, so its must-have verdicts were accepted as evidence.

## Root cause
The must-have criteria carried no acceptance test naming the tool category they admit, so the writer scored a diagram generator against state-machine-library expectations and recorded misses the source does not support.

## How confirmed
A fresh validator re-read the source and the criterion text, independent of the writer's ledger, and scored the candidate PASS on all three; the only difference was category interpretation, not evidence.

## Prevention
Write each must-have as an observable test plus one candidate it admits and one it excludes, before any scoring. Have a second reader re-check must-have verdicts blind to the writer's ledger.
