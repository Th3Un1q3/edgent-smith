---
id: claims/opencode/workflow_reliability_primitive
type: claims
L0: "Put bounded concurrency, budget, timeouts and resume inside the subtask primitive; Promise.all fan-out is then safe"
hotness: 0.9
ttl: 60d
version: 1
freshness: 2026-09-19
directory: claims/opencode
confidence: 0.9
status: active
provenance: .opencode/plugins/helpers/workflow-runner.ts
---
claim: A minimal workflow DSL of two helpers (subtask + log) is sufficient when subtask itself enforces reliability; naive Promise.all fan-out in user scripts is then safe.
Enforced inside the subtask primitive, not the script:
- bounded concurrency via a shared semaphore (createSemaphore(maxConcurrent), default 4).
- total budget (default 32 subtasks; exceeding throws BudgetExceededError -> status budget_exceeded).
- per-subtask timeout and overall workflow timeout, aborting through AbortController and session.abort.
- resume by reusing task_id (child session id) instead of creating a new session.
- empty-output detection (status 'empty') and output truncation.
- structured envelope {status, result, steps, stats, logs} serialized to about 8 KB cap.
Rationale: reliability at the single choke point means scripts cannot get concurrency/timeout/resume wrong; failed children return statuses instead of throwing, so Promise.all does not reject.
evidence: .opencode/plugins/helpers/workflow-runner.ts:385-445 (runWorkflow), :25-67 (semaphore), :317-335 (context), :166-298 (envelope); .opencode/plugins/helpers/workflow-subtask.ts:441-561 (createSubtask); tool schema .opencode/plugins/workflow.ts:12-47.