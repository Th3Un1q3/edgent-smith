---
id: experiences/orchestration/null-returns-are-not-absence
type: experiences
L0: "An empty return is unread, not absent: a no-hits search, a child's blank report, and a matching number prove nothing until a second, named probe confirms it — different stem or scope, files-searched count, artifact body — with both probes cited."
ttl: 180d
freshness: 2026-10-27
provenance: "task-delegation 1.5.31 review 2026-10-27 — a head-cut single-stem grep scored a false negative; subtask_tail returned empty on three completed children whose edits had landed; an 8 KB envelope cap was recorded as the measured output cap"
---
# Null returns are not absence

## Idea
A negative or equivalence result is a claim like any other, and one probe cannot support it.

## Scope
Orchestration and delegation review: absence claims over a repo ("X has no hits", "all guidance lives in Y"), equivalence claims between two named things ("A is the same as B", "reconciled to the measured cap"), and empty child returns.

## Rationale
- A single-stem grep with `head` cut the output and searched nothing else, so the silence read as "not found" and absence left no output to notice. A negative-scope claim needs a second search: different stem, explicit scope, printed files-searched count, no `head`, both commands cited.
- An enumerated cap name was recorded as a measurement: 8 KB was MAX_ENVELOPE_BYTES, not the measured output cap. An equivalence claim names both identifiers and the file each was read from.
- `subtask_tail` returned empty for three completed children whose edits had landed, and a resumed editor returned empty output while its edits had applied. An empty report is not evidence of no edit: read the artifact — file body, identifier count, gate output — and relaunch only on artifact evidence.
- A restarted server left two of four comments written; the tree, not the child transcript, showed the partial state.

Source: task-delegation 1.5.31 review, 2026-10-27; orchestrator observations of empty tails, an empty resume, and an interrupted edit; the review child's head-cut grep finding. Related: mem:lessons/delegated-read-only-discovery-truncation, mem:cases/concurrent-worktree-change-attribution.