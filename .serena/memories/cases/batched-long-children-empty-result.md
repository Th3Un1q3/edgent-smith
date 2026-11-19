---
id: cases/batched-long-children-empty-result
type: cases
L0: "A batched dispatch of two long children returned status error with empty outputText for both; each resumed alone succeeded. A gate run belongs alone and in the background; batch only children that report inside one window."
hotness: 0.6
ttl: 180d
version: 1
freshness: 2026-11-16
directory: cases
status: active
provenance: "RUG orchestration run 2026-11-16; children ses_e1a18bb68ffeFNKxVJOPuDSgkb, ses_e1a18bb69ffeQgIkFmLzQ9uoUe; directory reads same run"
---
scope: cases — one observed failed round with its fix, not a claim (no atomic fact) and not a trajectory (one incident).

## Symptom
One `Promise.all` dispatch carried a ~25-minute validator and a memory writer. Both returned `status: error` with an empty `outputText`. Each resumed by `task_id`, one `execute` call at a time, returned a usable report. The validator's first `just ci` had been aborted mid-run and finished only after it was backgrounded with its log tailed.

## False hypothesis
Both children had failed on their own briefs, so the round needed fresh launches. An error status with no body reads as failure.

## Root cause
The batched `execute` call closed before either long child reported. `task-delegation/SKILL.md:93` mandates batching independent children and `:146` permits one-at-a-time only after an interruption has already cost the round; the precedence for a child that outruns the call window is unstated. The dispatch set no `timeout_minutes`, which `:135` requires for a full suite or CI gate.

## How confirmed
Same two `task_id`s, same briefs, sequential dispatch: both produced their deliverables. `SKILL.md:88` already required the gate to be scheduled in the background before the validator's first read, and the child's report names backgrounding plus a log tail as its unblock.
Source: orchestrator run observations 2026-11-16; children ses_e1a18bb68ffeFNKxVJOPuDSgkb and ses_e1a18bb69ffeQgIkFmLzQ9uoUe.

## Prevention
Dispatch a child alone when its work outruns one `execute` window (gate run, full suite, 20+ minute enumeration) and set `timeout_minutes` for it; batch only children expected to report inside the window. A gate-running child starts the gate in the background on its first call and tails the log, per `:88`. Read an empty error return as unread: tail, then resume one `task_id` per call.
Boundary: `mem:cases/orchestration/resume-error-empty-error-text` covers the narrower shape where the resume itself returns an empty error and a fresh child is the fix; `mem:cases/orchestration/execute-body-hygiene-and-timeout-scoping` covers the timeout mis-scoping.