---
id: projects/opencode-workflows/user-stories/US_09_label_binding_module
L0: "US-09 Must: pure subtask-labels.ts validates and never normalizes labels, round-trips the binding map, emits audit rows, and refuses running, dead and fork cases"
freshness: 2026-11-24
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: architecture/adr/ADR-024-labelled-subagent-sessions; .opencode/plugins/workflow/contracts.ts
---
# US-09 — Label binding as a pure module

Priority: Must
Slice: 1
Contract: ADR-024 Decision — Validation, Resume, No rebinding, Exclusion
Depends on: none
Status: proposed

## Story

As the workflow plugin author, I want the label rules in one pure module, so that every dispatch path shares a single binding model and a verifier can test the rules without a session.

## Requirements

R1. workflow/subtask-labels.ts exports isValidLabel, parseLabel, encodeBindings, decodeBindings, auditRow, resolveBinding and lookupLabel.
R2. A label is valid only when it matches the pattern in ADR-024 (lowercase letter first, then lowercase letters, digits, dot, underscore or hyphen, at most 32 characters). An invalid label is refused with reason invalid_label; it is never trimmed, lowercased or otherwise rewritten.
R3. encodeBindings and decodeBindings round-trip a map of label to {childSessionId, boundAt} through JSON. Missing or malformed JSON decodes to an empty map; the decoder never throws.
R4. auditRow returns one row per bind carrying label, child_session_id and bound_at.
R5. resolveBinding(label, bindings, childStatus) returns a resume decision for a known label, a bind decision for an unknown one, or a refusal with reason child_running, child_dead or label_fork_conflict. A call carrying both a label and fork_from is refused as label_fork_conflict.
R6. Each refusal names the label and, where a child exists, its session id.
R7. The module performs no I/O and imports no session entry, filesystem or SDK module.

## Acceptance criteria

AC1. plugins/tests/workflow/subtask-labels.test.ts — feed Alpha, a space-containing name and a 33-character name, then expect invalid_label and the input string unchanged.
AC2. Same file — decodeBindings(encodeBindings(m)) equals m, and decodeBindings of non-JSON text returns an empty map without throwing.
AC3. Same file — auditRow for label coder, child ses_1 and time t yields exactly {label, child_session_id, bound_at}.
AC4. Same file — resolveBinding returns resume for a finished child, bind for an unknown label, and the three refusals naming label and child id.
AC5. Same file — a source scan of the module lists no runtime import outside local types.

## How to demo

What you will show: bad labels refused, one good label binding one child.

1. `subtask_run({ label: 'Bad Label', prompt: 'hi' })`, then `Alpha`, then a 33-character name.
2. `subtask_ls({ count: 20 })`.
3. `subtask_run({ label: 'demo-one', prompt: 'Reply exactly: TURN-ONE-OK.' })`, then again with `prompt: 'Say TURN-TWO-OK.'`.
4. `subtask_run({ label: 'demo-one', fork_from: '<task_id from step 3>' })`.

What you should see:
- Each bad name returns status: error, no task_id, and `"Bad Label" must match ^[a-z][a-z0-9._-]{0,31}$ and must not look like a session id (ses_)`.
- `Alpha` comes back as `Alpha`; no child from the three refusals shows in `subtask_ls`.
- Step 3 returns one task_id twice: the name resumes that child, never rebinds.
- Step 4 returns status: error, no task_id, `label_fork_conflict`.

## References

- mem:architecture/adr/ADR-024-labelled-subagent-sessions
- .opencode/plugins/workflow/subtask-labels.ts
- .opencode/plugins/tests/workflow/subtask-labels.test.ts
- .opencode/plugins/workflow/contracts.ts

## Out of scope

scripts/conductor/ session map. A justfile read-only binding view. Any .agents/skills/task-delegation edit. Cross-session labels. Persona or agent resolution from a label. Queueing and fork-on-conflict. Session entry writes, which belong to US-11.