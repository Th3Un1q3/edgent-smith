---
id: preferences/rug_rework_dependencies
type: preferences
L0: "Rug dependencies: stage before after on-fail table with SHOULD defaults for ordering subtask_run chains"
hotness: 0.9
ttl: 90d
version: 1
freshness: 2026-10-21
directory: preferences
provenance: rug.md rework 2026-10-21 grilling Q&A
---
# Rug Dependencies

Order chains with a stage table. Defaults are SHOULD, not MUST.

| stage | before | after | on-fail |
|---|---|---|---|
| research | plan | synthesis | retry once, then report |
| plan | research | build | block build, revise plan |
| build | plan | validate | fix forward or resume builder |
| validate | build | return | reject, never auto-merge |

Rules: declare `before`/`after` via `resume` or `fork_from` links; SHOULD follow table order; on-fail stops the chain and reports — never skip validation.
