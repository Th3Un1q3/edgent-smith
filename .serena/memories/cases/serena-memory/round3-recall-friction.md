---
id: cases/serena-memory/round3-recall-friction
type: cases
L0: "Round 3 (post round-3 fixes): recall 4 gateway calls (1 list + 3 reads); scope choice unambiguous (case); friction reduced vs round 2"
freshness: 2026-10-24
hotness: 0.5
ttl: 90d
---

# Case — serena-memory round 3 recall friction

Failure: round 3 (post round-3 fixes) still needed 4 gateway calls (1 list_memories + 3 read_memory) before storing; store gating still spans multiple reference files.

Fix: round-3 fixes confirmed case scope is unambiguous for friction narratives; keep recall to L0-only reads and one typed write; scope choice (case vs claim) resolved to cases/*.

Evidence: mem:cases/serena-memory/round2-recall-friction, mem:entities/serena-memory/improvement-goal.
