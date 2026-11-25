---
id: projects/opencode-workflows/user-stories/US_11_label_binding_and_dispatch
L0: "US-11 Must: first labelled dispatch binds label to child in workflow.labels, later calls resume it, running and dead children are refused, and one label yields one task_id"
freshness: 2026-11-24
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: architecture/adr/ADR-024-labelled-subagent-sessions; .opencode/plugins/workflow.ts:287-318
---
# US-11 — Persist the binding and route dispatch

Priority: Must
Slice: 3
Contract: ADR-024 Decision — State carrier, Resume, No rebinding, Live conflict
Depends on: US-09, US-10
Status: proposed

## Story

As a dispatching agent, I want a label I used earlier to resume the same child after compaction, so that a retry re-prompts a child that already holds context instead of starting a new one.

## Requirements

R1. workflow.ts reads and writes the binding map in the session entry path workflow.labels, mapping label to {childSessionId, boundAt}, so a rebuilt tool context or a compaction does not lose it.
R2. A first labelled dispatch binds the label to the child it created and appends one audit row through auditRow.
R3. A later dispatch on that label whose child has finished, whether ok or empty, resumes that child and returns its task_id; it creates no new child.
R4. A later dispatch while the child still runs is refused, naming the label and the running child; the plugin creates no second child and queues nothing.
R5. A later dispatch whose child is dead is refused, naming the dead child; the label is never rebound to a new child.
R6. Two labelled dispatches in one process for the same unbound label create one child and return one task_id.
R7. The binding write happens once per label per session, and an unlabelled dispatch performs no entry write.
R8. The binding and dispatch logic lives in .opencode/plugins/workflow/subtask-label-dispatch.ts, imported by workflow.ts line 24; that module owns the workflow.labels entry read and write through findEntry and writeEntry, the child-state derivation, the checkResume refusals, the per-session-and-label process lock, and the workflow.labels.bound, .resumed and .bind_failed log lines.

## Acceptance criteria

AC1. plugins/tests/workflow/subtask-label-binding.test.ts — a first labelled dispatch writes workflow.labels with the label, one child id and a bind time.
AC2. Same file — a second dispatch on a finished ok child returns the same task_id and the harness records no second create.
AC3. Same file — a second dispatch on a finished empty child likewise resumes it.
AC4. Same file — a second dispatch while the child runs returns a refusal naming label and child id, with one create recorded.
AC5. Same file — a second dispatch after the child dies returns a refusal naming the dead child and the map still points at it.
AC6. Same file — two concurrent labelled dispatches on one unbound label produce one task_id and one map entry.
AC7. Same file — an unlabelled dispatch leaves the entry unchanged.

## How to demo

What you will show: one label brings back the child that already answered.

1. `subtask_run({ label: 'e2e-label', prompt: 'Reply exactly: TURN-ONE-OK.' })`, then again with `prompt: 'Quote your last reply, then write TURN-TWO-OK.'`.
2. Read `<context key="workflow.labels">`.

What you should see:
- Call 2 returns the same task_id, `TURN-ONE-OK.` then `TURN-TWO-OK.`
- The context block holds the `e2e-label` binding.

## References

- mem:architecture/adr/ADR-024-labelled-subagent-sessions
- .opencode/plugins/workflow.ts
- .opencode/plugins/workflow/subtask-labels.ts
- .opencode/plugins/workflow/subtask-label-dispatch.ts
- .opencode/plugins/tests/workflow/subtask-label-binding.test.ts

## Out of scope

scripts/conductor/ session map. A justfile read-only binding view. Any .agents/skills/task-delegation edit. Cross-session labels. Persona or agent resolution from a label. Queueing and fork-on-conflict. Durability beyond the session entry.