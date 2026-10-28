---
id: claims/opencode/workflow_reliability_primitive
type: claims
L0: "Put budget, timeouts, resume and empty-output detection inside the subtask primitive; Promise.all fan-out is then safe up to the 32-subtask budget, with no concurrency cap since 2026-10-28"
hotness: 0.9
ttl: 60d
version: 2
freshness: 2026-10-28
directory: claims/opencode
confidence: 0.9
status: active
provenance: .opencode/plugins/helpers/workflow-subtask.ts
---
claim: A minimal workflow DSL of two helpers (subtask + log) is sufficient when subtask itself enforces budget, timeout, resume and empty-output detection; naive Promise.all fan-out is then safe up to the 32-subtask budget.
Enforced inside the subtask primitive, not the script:
- total budget (default 32 subtasks; exceeding throws BudgetExceededError -> status budget_exceeded).
- per-subtask timeout and overall workflow timeout, aborting through AbortController and session.abort.
- resume by reusing task_id (child session id) instead of creating a new session.
- empty-output detection (status 'empty').
Removed with the engine on 2026-10-28, so they no longer back this claim: the shared semaphore and its `max_concurrent` bound, per-step output truncation, the structured envelope with its 8 KB cap and its `stats` field, fork lineage.
Rationale: reliability at the single choke point means scripts cannot get budget/timeout/resume wrong; failed children return statuses instead of throwing, so Promise.all does not reject. Concurrency is no longer bounded, so wide fan-out now raises simultaneous children to the budget ceiling.
evidence: .opencode/plugins/helpers/workflow-subtask.ts (createSubtask), .opencode/plugins/workflow.ts (trio registration); 2026-10-28 state per mem:architecture/adr/ADR-017-prune-plugin-suite-to-hook-core, ## Implementation (2026-10-28).