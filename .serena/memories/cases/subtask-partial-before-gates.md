---
id: cases/subtask-partial-before-gates
type: cases
L0: "Implementer spent its whole budget on edits plus a lint refactor and reported 'edits done, gates unverified' twice; partial reports did not name the unverified criteria."
hotness: 0.5
ttl: 180d
version: 2
freshness: 2026-11-11
directory: cases
provenance: operator report of the 2026-11-11 orchestration run
claim_ids: []
---

# Subtask reported partial before running the gates

Source: operator report of the 2026-11-11 orchestration run; the run's transcripts were not available in this session, so each claim below is recorded as reported, not independently re-read.

## Symptom
A delegated implementer spent its entire call budget on edits plus a lint refactor and twice returned the same partial report: edits done, gates unverified.

## False hypothesis
The edits are the deliverable and the gates are a follow-up: a report that states their status honestly is enough, and an honest partial costs nothing.

## Root cause
No calls were reserved for the named gates. The lint refactor grew after the budget had been committed to edits, so the last calls went to more editing, and neither partial report enumerated which criteria were left unverified.

## How confirmed
Both reports carried the same phrasing and no gate output; the run's call ledger showed the final calls spent on edits and the refactor rather than on the gates.

## Prevention
Reserve the final two calls for the named gates, and a partial report names every unverified criterion rather than a status phrase. Related: mem:cases/brief-omitted-test-max-lines, mem:cases/validator-evidence-bar-ambiguous.