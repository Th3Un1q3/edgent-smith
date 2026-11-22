---
id: cases/session-2026-11-21-aidlc-research
type: cases
L0: "Session ledger: the 14 failures of the 2026-11-21 awslabs/aidlc-workflows run in five groups, each group naming the case that carries its lesson."
hotness: 0.4
ttl: 180d
version: 4
freshness: 2026-11-21
directory: cases
status: active
confidence: 0.9
claim_ids: []
provenance: "Run record of the 2026-11-21 session on awslabs/aidlc-workflows; groups derived from the failure rows."
---
# Session ledger - 2026-11-21 awslabs/aidlc-workflows run

Ledger of the run's 14 failures, grouped by shared cause; each group names the case that carries its lesson.

## Groups
- G1 the dispatch author assumed child properties instead of verifying them (F1,F2,F6,F14) - mem:cases/shell-denied-in-subtask, mem:cases/orchestration/reading-children-without-capture-pack, mem:cases/orchestration/resume-error-empty-error-text
- G2 the dispatch author stated limits but never divided them into units (F3,F8,F13) - mem:cases/orchestration/limits-not-converted-to-unit-arithmetic
- G3 the verifier read a rendering instead of the artifact (F10,F11,F12) - mem:cases/orchestration/rendering-read-as-artifact
- G4 the dispatch author resolved destination authority from memory instead of reading it (F4,F5,F7) - mem:cases/serena-memory/pre-named-targets-wrong-namespace
- G5 the reviewer never ran the artifact against its own rules (F9) - mem:cases/orchestration/spec-gates-unchecked-for-satisfiability
