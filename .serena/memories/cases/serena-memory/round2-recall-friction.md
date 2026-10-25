---
id: cases/serena-memory/round2-recall-friction
type: cases
L0: "Round 2 recall surfaced serena/serena-memory; friction was 4 reads and ambiguous store gating"
freshness: 2026-10-24
hotness: 0.5
ttl: 90d
---

# Case — serena-memory round 2 recall friction

Failure: the recall path needed 4 `read_memory` calls before an answer, and store gating spanned 4 reference files.

Fix: run `list_memories({})` once, read only candidate L0s, then write one typed memory and read it back; keep store gating to `typing.md` + `frontmatter.md`.

Evidence: `mem:serena/serena-memory`, `mem:entities/serena-memory/improvement-goal`.
