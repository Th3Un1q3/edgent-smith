---
L0: "Two server restarts killed an execute mid-dispatch: the task_id existed only inside the killed call, so reattaching depended on enumeration, not on a recorded handle; blind relaunch would have re-run the test authoring."
name: cases/dispatch-handle-lost-to-restart
description: Two server restarts killed an execute mid-dispatch; the child handle survived only because subtask_ls and tail were checked before relaunching, and a blind relaunch would have duplicated the work.
type: cases
scope: cases
status: active
confidence: 0.8
timestamp: 2026-11-10
tags: [orchestration, subtask, restart-recovery, idempotency]
sources: [undefined]
---

# Restart: the dispatch handle lived in the killed call

## Failure Modes

- **Symptom.** Two server restarts killed an execute call mid-dispatch. The child survived only because subtask_ls and subtask_tail were consulted before relaunching.
- **False hypothesis.** The one not made, and the expensive one: that a killed execute means a dead child, so relaunch it.
- **Root cause.** The task_id lived only inside the call that was killed, so recovery depended on discipline rather than on a record. Subagent Failure Recovery has step 1 (tail) and step 2 (relaunch) and no step 0 (enumerate and reattach).
- **How confirmed.** The child was still listed after both restarts, which proves a relaunch would have created a second test-authoring run rather than resuming the first.
- **Prevention.** A step 0 in Subagent Failure Recovery: after a restart or Tool execution interrupted, run subtask_ls and resume the recorded task_id before any relaunch; and record task_id, brief hash and artifact path beside the plan before the execute that dispatches, so the handle outlives the call.

## Evidence

Source: session observations from the aidlc-workflows integration run (2026-11-10); subtask_ls named as the live tool at task-delegation/SKILL.md:23, verified this session.

## References

mem:cases/delegation-goal-gate-and-prompt-width — same harness, dispatches lost mid-run.