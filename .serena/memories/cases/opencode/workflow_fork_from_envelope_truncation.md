---
id: cases/opencode/workflow_fork_from_envelope_truncation
type: cases
L0: "Workflow reducer can exceed the ~8 KB envelope cap even when subtask data is not truncated; return compact reducers; recover by resuming the producer session with a schema"
hotness: 0.8
ttl: 180d
version: 1
freshness: 2026-09-20
directory: cases/opencode
provenance: "Observed workflow run, 2026-09-20"
---
# Workflow reducer envelope truncation
A large reducer returned from a workflow script can be truncated by the ~8 KB envelope cap even when individual subtask `data` is not truncated. Per-step `outputText` caps at 4000 chars, but structured `data` is never truncated or stringified.
- Symptom: envelope `result` trimmed, then steps and logs dropped.
- Fix: return compact reducers (ids + status), not full payloads.
- Recovery: resume the truncated producer session with a schema that returns structured fields, so the answer arrives in `data` instead of a bloated `result`.
Source: observed workflow run. See mem:entities/opencode-plugin/workflow_fork_from_fanout.