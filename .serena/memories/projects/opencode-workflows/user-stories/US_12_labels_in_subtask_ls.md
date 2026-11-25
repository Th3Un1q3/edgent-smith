---
id: projects/opencode-workflows/user-stories/US_12_labels_in_subtask_ls
L0: "US-12 Should: subtask_ls joins the binding map so each labelled child shows its label beside the description it already prints"
freshness: 2026-11-24
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: architecture/adr/ADR-024-labelled-subagent-sessions; .opencode/plugins/workflow/subtask-ls.ts
---
# US-12 — Labels visible in subtask_ls

Priority: Should
Slice: 4
Contract: ADR-024 Decision — State carrier; Context on the description
Depends on: US-11
Status: proposed

## Story

As a dispatching agent, I want each labelled child to show its label in the child list, so that I can pick the name from the listing instead of inferring it from an 80-character description.

## Requirements

R1. LsEntry gains an optional label field, absent when the child has no label.
R2. subtask_ls joins each listed child against the same workflow.labels map that US-11 writes, and sets label from the matching entry.
R3. A child absent from the map lists without a label key.
R4. The listing reads no store beyond the session entry map and adds no write.

## Acceptance criteria

AC1. plugins/tests/workflow/subtask-ls-label.test.ts — a child bound to coder lists with label coder.
AC2. Same file — an unbound child lists without a label key.
AC3. Same file — the listing call leaves workflow.labels unchanged.
AC4. plugins/tests/workflow/subtask-ls.test.ts — the existing listing cases still pass with the field absent.

## How to demo

You will show which rows in `subtask_ls` carry a label and which carry none.

1. `subtask_run({ label: 'e2e-label', description: 'e2e turn one', prompt: 'Reply with exactly this line and nothing else: TURN-ONE-OK.' })`.
2. Again under the same label: `subtask_run({ label: 'e2e-label', description: 'e2e turn two', prompt: 'Quote exactly what you replied in your previous turn, then on a new line write TURN-TWO-OK.' })`. The second call resumes, so both turns belong to one child.
3. One dispatch with no label: `subtask_run({ description: 'plain turn', prompt: 'Reply with exactly: PLAIN-OK.' })`.
4. List the children: `subtask_ls({ count: 20 })`.

What you should see:
- The labelled child's row carries `"label":"e2e-label"` beside its description and status, so the name you dispatched is the name you read back.
- The plain child's row has no label key at all.
- The two labelled dispatches produce one row, not two, because the second resumed the bound child.
- The listing call changes nothing in `workflow.labels`; read the context block before and after and it is identical.

Why it matters: a label you cannot see is a label you have to remember; the listing now says which child is which without decoding an 80-character title.

## References

- mem:architecture/adr/ADR-024-labelled-subagent-sessions
- .opencode/plugins/workflow/subtask-ls.ts
- .opencode/plugins/workflow/contracts.ts
- .opencode/plugins/tests/workflow/subtask-ls-label.test.ts

## Out of scope

scripts/conductor/ session map. A justfile read-only binding view. Any .agents/skills/task-delegation edit. Cross-session labels. Persona or agent resolution from a label. Queueing and fork-on-conflict. Label filtering or sorting in the listing.