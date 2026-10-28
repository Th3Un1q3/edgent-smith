---
id: claims/comments/todo-markers-banned-but-temporarily-authorized
type: claims
L0: "The repo comments policy bans TODO/FIXME markers; a user-requested scope TODO is temporary and must be deleted as each change lands, because the policy outranks it."
hotness: 0.7
ttl: 180d
version: 1
freshness: 2026-10-27
directory: comments
confidence: 0.9
status: active
provenance: .opencode/instructions/comments.instructions.md, section 7; docs annotation run, 2026-10-27
---

# TODO markers are banned, so requested ones are temporary

idea: a user-requested TODO is authorized only until its change lands, then it is deleted.

scope: claims — one repo policy plus its consequence for delegated scope markers.

rationale: `.opencode/instructions/comments.instructions.md` section 7 bans TODO, FIXME, TBD, and placeholder markers as bookkeeping, and a user instruction outranks the policy only for the scope it names, so the marker cannot survive the work it marks.

Source: `.opencode/instructions/comments.instructions.md` (section 7, "Task, placeholder, and bookkeeping markers"); the delegation run that needed scope TODOs, 2026-10-27.

Consequence: a prompt that requires TODO markers says each marker is deleted in the same change that resolves it, and the closing validator checks that none remain.
