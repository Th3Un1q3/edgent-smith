---
id: cases/validator-evidence-bar-ambiguous
type: cases
L0: "Final validator had 10 criteria, judged the cheap ones by path:line quotes, left the one named command (just ci) unrun, and returned UNVERIFIABLE."
hotness: 0.5
ttl: 180d
version: 2
freshness: 2026-11-11
directory: cases
provenance: operator report of the 2026-11-11 orchestration run
claim_ids: []
---

# Validator evidence bar ambiguous across criteria

Source: operator report of the 2026-11-11 orchestration run; the run's transcripts were not available in this session, so each claim below is recorded as reported, not independently re-read.

## Symptom
A final validator held 10 criteria. It judged nine of them by quoting paths and lines, never ran the one command a criterion named (`just ci`), and returned UNVERIFIABLE for that criterion.

## False hypothesis
One evidence bar serves a whole criterion set: if a path:line quote proves nine criteria, the tenth is provable the same way.

## Root cause
The criteria were never partitioned by evidence type. The single command-named criterion was treated as readable from source, and by the time it was reached the validator had spent its budget on the cheap quotes.

## How confirmed
The verdict listed nine judged criteria and one UNVERIFIABLE; the UNVERIFIABLE text contained the command name, and the verdict contained no run output for it.

## Prevention
A criterion that names one command admits no substitute: its gate runs first, before the quote-based criteria. Related: mem:cases/subtask-partial-before-gates, mem:cases/orchestration/delegated-report-completeness-contract.