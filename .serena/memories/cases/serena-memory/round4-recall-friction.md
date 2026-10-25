---
id: cases/serena-memory/round4-recall-friction
type: cases
L0: "Round 4 (post round-4 fixes): recall 3 gateway calls (1 list + 2 reads); scope unambiguous (case); skill surfaced; read-back echo verified"
freshness: 2026-10-24
hotness: 0.5
ttl: 90d
---

# Case — serena-memory round 4 recall friction

Failure: round 4 (post round-4 fixes) recall still requires 1 list_memories plus 2 read_memory calls before store; large unfiltered list needs shell filtering to locate serena-memory entries; reference files (typing, gateway-protocol) consulted outside gateway.

Fix: keep recall to L0-only reads of the core skill memory and latest round case; scope choice (case vs claim) resolved to cases/* for friction narratives; store with frontmatter mirroring round3 template; read-back echo verified.

Evidence: mem:serena/serena-memory, mem:cases/serena-memory/round3-recall-friction.
