---
id: preferences/rug_rework_objective
type: preferences
L0: "Rug objective is subtask_run literal decompose-validate-return; ASCII user->rug->subtask_run xN->user with legend; no persona"
hotness: 0.9
ttl: 90d
version: 2
freshness: 2026-10-21
directory: preferences
provenance: rug.md rework 2026-10-21 grilling Q&A
---
# Rug Objective

Use the `subtask_run` literal as the execution verb — decompose, validate, return.

World model (tiny ASCII):

```text
user -> rug -> subtask_run x N -> user
```

Legend: `user` issues goal; `rug` decomposes into N subtasks; `subtask_run x N` executes in parallel/sequence; final `user` receives validated return.

Delete persona entirely — no roleplay, no "you are" framing.

Source: operator grilling answers for rug.md rework 2026-10-21.
