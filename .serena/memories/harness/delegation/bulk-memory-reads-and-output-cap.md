---
id: harness/delegation/bulk-memory-reads-and-output-cap
type: experiences
L0: "Delegation: batch Serena reads at 8 per call, one line each; state output budgets in characters covering table, prose, and sentinel; size findings x chars and split an over-cap round by field; resume to recover a cut tail."
hotness: 0.5
ttl: 180d
freshness: 2026-10-25
directory: harness/delegation
provenance: adr-state and web-facts child reports, 2026-10-25 run
---
# Bulk memory reads and output caps

- **Batch gateway enumeration.** Read at most 8 memories per gateway call with one line per memory (name plus title or status). A 20-item single batch truncated mid-body and exhausted the child's 24-call budget; splitting keeps the inventory.
- **Budget report prose against 4000 chars.** Subtract every mandated block (validation block, sentinel, per-item rows) before setting a word cap. A 600-word cap plus mandatory blocks exceeded 4000 chars and cut the tail.
- **Order mandated sections highest-priority-first.** A truncation at 4000 chars then removes the least important section instead of a required one.
- **Recover a lost tail by resuming the same child** with its `task_id`, not relaunching: the resume reuses context and skips repeated discovery.
- **State the budget in characters for any table or ledger.** A word cap bounds prose only: eight one-line-per-field findings at ~300 chars each exceed 4000 chars inside a 400-word cap, and the cut lands silently. One sum covers table, prose, and sentinel.
- **Budget the product before writing.** findings x per-finding chars: 8 at 300 fit, 15 at 400 do not; when the product exceeds the cap, split the round - findings and risk tags first, evidence second - and resume a tail cut at the cap with that split, never another tail.
- Source: adr-state and web-facts child reports from the 2026-10-25 run. The 8-per-call figure is the run's prescription, not a measured optimum.