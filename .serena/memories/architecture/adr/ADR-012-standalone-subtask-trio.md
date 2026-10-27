---
id: ADR-012
title: Standalone trio subtask_run, subtask_ls, subtask_tail - Deprecate workflow
status: accepted
date: 2026-10-21
scope: gateway code-mode trio with shared prefix for permissions
---

# ADR-012: Standalone trio subtask_run, subtask_ls, subtask_tail - Deprecate workflow

Status: Proposed

## Context
Current execute->workflow->subtask obstruction confuses agents across three levels; routing, budgeting, pickup require wrapper hops even for direct code-mode calls, raising load and failure modes.

## Decision
- subtask_run standalone direct code-mode call, replacing wrapped invocation; prefixed trio for permission scope.
- deprecate workflow: three-level nesting obstructs routing; scripts enter maintenance-only path.
- subtask_ls lists task_id/status/idempotency_key/updated_at; filter status/owner + sort updated_at; default count 10 cap 50.
- subtask_tail last-N outputs by task_id; owner-scoped token required; unknown id returns uniform NOT_FOUND.
- log retired with workflow (log-retired): workflow-script helper only; trio needs no separate log.
- prefix freeze: exact allowlist [subtask_run, subtask_ls, subtask_tail]; deny subtask_* wildcard.
- runtime: over max_concurrent run returns QUEUE_FULL with retry_after_ms (no spin); registry reaper owns timeout independent of caller; errors unified {code,message,retryable,redirect}; stats endpoint replaces computeStats/toasts.

## Consequences
+ Simpler model: prefixed trio with clear scopes; faster triage/pickup without hops.
- orphans: workflow scripts need migration; budgeting moves to registry; tail adds storage cost.

## Alternatives
- keep-both rejected: retains confusion, doubles permission surface.
- facade rejected: preserves nesting plus indirection.
- prompt-fix rejected: docs-only, obstruction remains.

## Resolved Decisions (Q1-Q4 fixed 2026-10-21, no open questions)
- Q1 budgeting: caller-side enforcement against global registry, no workflow grouping. Caps max_subtasks=32/session, max_concurrent=8, timeout_min=10. Registry owns ledger; run increments/decrements, refuses over cap with BUDGET_EXCEEDED; 9th caller gets QUEUE_FULL.
- Q2 tail persistence: bounded. Last 5/task_id (default 3, max 5), 12KB/entry truncated:true, total <=60KB, 24h TTL lazy-expire + hourly sweep, max 1000 task_ids LRU.
- Q3 staleness guard: idempotency key + status claimed/done. Tail returns task_id+status+key+updated_at; skip rerun when done or key matches. Run requires key; duplicate returns prior result.
- Q4 migration: shim->codemod->remove. P1 shim delegates subtask->subtask_run, log->capped tail with warning. P2 codemod subtask()->subtask_run, log(x)->no-op/tail, gated by checkScript. P3 remove at zero non-shim callers; terminal error redirects to trio.

## Limits/Edge cases
- ls cap 50 prevents full-scan token burn; tail 60KB/task bounds secrets retained 24h; owner check on tail blocks cross-principal replay (NOT_FOUND leaks no oracle).
- timeout reap by registry independent of caller death; QUEUE_FULL backoff retry_after_ms stops retry storm.

## Rollback/Test notes
- Rollback: codemod checkpoint per script; auto-rollback if checkScript finds >0 non-shim callers; shim kill-switch restores workflow if zero-caller never reached.
- Tests: contract tests pin ls default/cap, tail 5-entry/12KB/60KB/24h caps, QUEUE_FULL shape, unified error schema, NOT_FOUND on unknown id.

## Status update (2026-10-25)

Status set to `accepted`. The code half of this decision is in the tree: `subtask_run`, `subtask_ls` and `subtask_tail` are registered in `.opencode/plugins/workflow.ts`, no `workflow` tool is registered, and the retirement comment at `workflow.ts:190` states the trio is the only execution surface.

Two residues remain, both text-only:
- `docs/workflow-tool.md` — the retirement banner at line 1 is accurate, but lines 5, 17 and 342-343 still describe a callable `workflow` tool and its whole-script timeout.
- `.opencode/agents/rug-workflow.md` — line 8 still grants `"workflow": "allow"`, and lines 18 and 423 speak of `workflow` in the present tense.

Both residues are documentation/agent-text drift, not a missing implementation. Nothing supersedes this ADR. The in-body `Status: Proposed` line is retained verbatim as the historical record of the original text.
