---
id: cases/orchestration/dirty-baseline-unverifiable-no-modification
type: cases
L0: "A verifier returned UNVERIFIABLE on 'no existing file modified' because the tree was dirty before the run; a pre-declared expected path plus the dirty baseline made the same criterion verifiable."
hotness: 0.6
ttl: 365d
version: 1
freshness: 2026-11-15
directory: cases/orchestration
status: active
provenance: orchestration run 2026-11-15 authoring a design-contract document; verifier round plus producer interview
related: mem:cases/orchestration/validator-external-diff-attribution
---
# A state assertion judged against a tree that was already dirty

## Symptom
A verifier returned UNVERIFIABLE on the criterion "no existing file modified": the working tree carried changes from before the run, so the post-run state could not separate this run's writes from the pre-existing ones.

## False hypothesis
The producer had modified an existing file, or the verifier was reading the wrong path. Both were investigated before the baseline was examined.

## Root cause
The criterion was written as a state assertion over the whole tree rather than as a delta against a baseline. A dirty tree before the run makes the post-run tree uninformative, and the verifier had no expected-path list to attribute writes against, so UNVERIFIABLE was the only honest verdict.

## How confirmed
`git status --porcelain` taken before the run showed pre-existing modified entries unrelated to the work. With the expected new path and the dirty baseline both declared, the same criterion verified: the only change attributable to the run was the declared path.

## Prevention
Capture the baseline (`git status --porcelain` plus the diff stat) before any write, and put it and the expected path set into the verifier brief. Verify a delta against the baseline, never against a clean tree, and write the criterion as "no path outside the declared set changed" so it has something enumerable to judge.