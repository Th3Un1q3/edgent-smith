---
id: cases/brief-omitted-test-max-lines
type: cases
L0: "Brief named three gates but not the 650-line test-file ceiling; implementer learned it from a failing lint gate, ran out of budget, reported four criteria UNVERIFIED."
hotness: 0.5
ttl: 180d
version: 2
freshness: 2026-11-11
directory: cases
provenance: operator report of the 2026-11-11 orchestration run
claim_ids: []
---

# Brief omitted the test-file line ceiling

Source: operator report of the 2026-11-11 orchestration run; the run's transcripts were not available in this session, so each claim below is recorded as reported, not independently re-read.

## Symptom
A delegated implementer returned a report with four acceptance criteria marked UNVERIFIED. The failing gate was lint, on a test file the implementer had just written, and the failure came late enough that no budget remained to split the file and re-run.

## False hypothesis
The brief was complete because it enumerated the three gates (lint, typecheck, tests). Naming a gate was taken to carry the threshold that gate enforces.

## Root cause
The gates were named; the ceiling one of them enforces was not. The repo's 650-line test-file cap lives in lint configuration, not in the gate list, so the implementer budgeted for gates it expected to pass and met an undisclosed constraint only after the file existed.

## How confirmed
The lint output named the line-count rule and the test file. Re-reading the brief showed three gate names and no ceiling. The four UNVERIFIED criteria were exactly the ones whose evidence depended on that file.

## Prevention
A brief states the ceiling for every file type it touches, next to the gate that enforces it, with the source path for the number. Related: mem:cases/subtask-partial-before-gates, mem:cases/orchestration/must-have-criterion-category-mismatch.