---
id: preferences/rug_rework_permission_denied
type: preferences
L0: "Rug permission-denied: retry once in canonical form then report and continue; never bypass the gate"
hotness: 0.9
ttl: 90d
version: 1
freshness: 2026-10-21
directory: preferences
provenance: rug.md rework 2026-10-21 grilling Q&A
---
# Rug Permission Denied

On denial: retry once in canonical form, then report and continue.

1. Retry once — plain form, one command per call.
2. Report exact command, denial text, and intended outcome.
3. Continue rest of task with permitted actions; ask user when gated action is essential.
4. Never bypass — no wrapper, subprocess indirection, or alternate path.

Never record a bypass recipe.
