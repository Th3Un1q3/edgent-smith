---
id: projects/opencode-workflows/user-stories/US_10_subtask_run_label_parameter
L0: "US-10 Must: subtask_run takes an optional label, refuses label with fork_from at validation before any child exists, and echoes the label in its result metadata"
freshness: 2026-11-24
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: architecture/adr/ADR-024-labelled-subagent-sessions; .opencode/plugins/workflow/subtask-parameters.ts
---
# US-10 — subtask_run accepts a label

Priority: Must
Slice: 2
Contract: ADR-024 Decision — Validation, Exclusion
Depends on: US-09
Status: proposed

## Story

As a dispatching agent, I want to name a child when I start it, so that I can refer to it by that name instead of copying a session id.

## Requirements

R1. contracts.ts adds label as an optional string to the subtask_run input schema and to SubtaskResult, with no default.
R2. subtask-parameters.ts parses the label through parseLabel from US-09 and passes it to dispatch unchanged.
R3. A call carrying both label and fork_from is refused during validation, before any child is created, with reason label_fork_conflict and a message naming both fields.
R4. A labelled call echoes label in its result metadata, equal to the input string.
R5. An unlabelled call keeps its current result shape, with the label key absent.
R6. workflow.ts adds the label to the existing parameter plumbing and changes nothing else in the tool contract.
R7. A call carrying both label and task_id is refused with reason label_task_conflict before any child is created, resumed or forked, because two sources of child identity in one call are ambiguous.

## Acceptance criteria

AC1. plugins/tests/workflow/subtask-run-label.test.ts — the input schema accepts a call with label and rejects a call whose label is not a string.
AC2. Same file — a call with label and fork_from returns the label_fork_conflict refusal and the harness records no child creation.
AC3. Same file — a labelled call returns result metadata whose label equals the input, and an unlabelled call has no label key.
AC4. plugins/tests/workflow/subtask-parameters.test.ts — parameter parsing passes a valid label through byte-identical and refuses an invalid one with invalid_label.
AC5. plugins/tests/workflow/subtask-run.test.ts — the existing unlabelled cases still pass unchanged.

## How to demo

What you will show: a named dispatch that keeps its child across turns, plus the two refusals that keep identity clear.

1. `subtask_run({ label: 'e2e-label', prompt: 'Reply exactly: TURN-ONE-OK.' })`, then again under `e2e-label` with `prompt: 'Quote exactly what you replied last turn, then on a new line write TURN-TWO-OK.'`.
2. `subtask_ls({ count: 20 })`, then read the context key `workflow.labels`.
3. `subtask_run({ label: 'e2e-label', fork_from: '<call 1 task_id>' })`, then the same with `task_id: '<call 1 task_id>'`.

What you should see:
- Call 1: status ok, task_id `ses_df1b50861ffeo4TzvkfQEP7s5H`, label `e2e-label` echoed.
- Call 2: that same task_id, `TURN-ONE-OK.` then `TURN-TWO-OK.`, the child quoting itself.
- The `subtask_ls` row carries `"label":"e2e-label"`.
- The context block reads `{"version":1,"bindings":[{"label":"e2e-label","taskId":"ses_df1b50861ffeo4TzvkfQEP7s5H","boundAt":"2026-11-24T16:02:51.992Z"}]}`.
- Step 3: status error on both calls, no task_id, `label_fork_conflict` then a `label_task_conflict` naming the bound child.

## References

- mem:architecture/adr/ADR-024-labelled-subagent-sessions
- .opencode/plugins/workflow.ts
- .opencode/plugins/workflow/contracts.ts
- .opencode/plugins/workflow/subtask-parameters.ts
- .opencode/plugins/tests/workflow/subtask-run-label.test.ts

## Out of scope

scripts/conductor/ session map. A justfile read-only binding view. Any .agents/skills/task-delegation edit. Cross-session labels. Persona or agent resolution from a label. Queueing and fork-on-conflict. Binding persistence and resume routing, which belong to US-11.