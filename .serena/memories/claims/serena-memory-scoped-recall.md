---
id: claims/serena-memory-scoped-recall
type: claims
L0: "list_memories topic filter splits on '-' — use first segment for hyphenated topics"
hotness: 0.67
ttl: 60d
freshness: 2026-10-24
status: superseded
provenance: "serena/serena-memory; superseded-by: claims/serena-memory-ralph-loop-lesson"
---
# Scoped recall hyphen split
list_memories({topic}) prefix filter splits on '-': a hyphenated topic such as 'serena-memory' matches nothing; use the first segment ('serena') plus a client filter, or underscore ids. Observed 2026-10-24: list_memories({topic:'serena-memory'}) returned empty; list_memories({topic:'serena'}) returned 4 memories including serena/serena-memory. Grounding: serena-memory workflow recall-memory.md §Hyphenated topics (F7). mem:serena/serena-memory

status: superseded
superseded_by: claims/serena-memory-ralph-loop-lesson