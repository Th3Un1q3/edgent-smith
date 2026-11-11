---
id: cases-research-search-snippet-figure-drift
type: case
hotness: 1.0
ttl: 90d
claim_ids: []
L0: "Research ledger FAIL from search-snippet star drift: figures came from rendered snippets, not the GitHub API"
---

# Search-snippet figure drift failed a sound research ledger

## Symptom

A verifier returned a run-level FAIL for 1-3% star-count differences across the cited repositories, plus one superseded release flagged, while every must-have verdict in the same run passed.

## False hypothesis

The ledger was wrong: the star counts had been miscounted, so the research behind the document was treated as unreliable and the run was rejected.

## Root cause

Two faults, neither of them in the ledger's reasoning:

- The figures came from rendered search-result snippets rather than the GitHub API. Snippets are stale copies of an index, so a 1-3% drift is normal and says nothing about the work.
- The verifier scored the decimals for exact equality instead of applying the 200-star threshold the criterion actually specified, so a figure comfortably above the bar failed on its last digits.

## How confirmed

Three independent children reported the same 1-3% band, which ruled out a single bad ledger entry, and the closing validator passed the document itself.

## Prevention

- State the figure source in the dispatch: name the GitHub API as the source, and treat search snippets as discovery only, never as cited numbers.
- State the threshold in the dispatch, and score must-haves against the threshold rather than exact equality.

See `mem:cases/about`.
