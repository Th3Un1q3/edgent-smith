---
id: claims/opencode/subtask_result_envelope
type: claims
L0: "subtask_run returns a JSON string; reading .status off the raw value yields undefined and misreports a good child as failed"
hotness: 0.7
ttl: 60d
version: 1
freshness: 2026-10-22
directory: claims/opencode
confidence: 0.9
status: active
provenance: RUG orchestration retrospective, verified 2026-10-22
---
# subtask_result_envelope
fact: The subtask_run tool's return value is a JSON string (workflow.ts calls JSON.stringify before returning), not an object. An orchestrator that reads .status or .outputText directly off the raw value gets undefined and reports a successful child as failed.
scope: RUG orchestrators consuming subtask_run results in this harness.
evidence: workflow.ts serializes the envelope; observed orchestration run reported a completed child as failed until the payload was JSON.parse'd.
rule: JSON.parse the returned string first, then read .status and .outputText.
Source: observed subtask_run output, 2026-10-22; .opencode/plugins/helpers workflow.ts.
## Recurrence 2026-10-23

Judging results before parsing reported three completed inventories as failures: a guard read `result.status` off the raw string, saw `undefined`, and flagged all three as failed. The outputs survived only because they were recovered with `subtask_tail` — about three calls, and a relaunch was nearly issued.

Extended rule: parse first, then read `status` and `outputText`. A completed result is never re-derived from the raw envelope, and a shape assumption is never grounds to relaunch work that already finished.
