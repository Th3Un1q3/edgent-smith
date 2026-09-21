---
id: cases/opencode/workflow_producer_unverified_tree
type: cases
L0: "Producer subagents can exhaust their tool-call budget before re-running quality gates after final edits, leaving the tree unverified; re-run gates in a fresh session; do not trust producer self-report"
hotness: 0.8
ttl: 180d
version: 1
freshness: 2026-09-20
directory: cases/opencode
provenance: "Observed orchestration run, 2026-09-20"
---
# Producer unverified tree after budget exhaustion
Producer subagents can exhaust their own tool-call budget before re-running quality gates after final edits, leaving the working tree unverified.
- Do not trust the producer self-report of success.
- Re-run the gates (`just ci-fast`, `just test`, `just lint`) in a fresh session, which can afford the verification calls.
Source: observed orchestration run. See mem:cases/opencode/workflow_fork_from_envelope_truncation.