# Prompt Discipline

**Use when:** writing subagent task prompts.

## Pitfalls

- Long multi-part prompts → subagents return a one-line status ("Found X, now reading Y") instead of the final artifact; resuming the session usually returns another status line.
- Overloading a single subagent with many concerns → truncation.
- Injecting very long skills into tiny tasks → wasted budget, early truncation.

## Rules

1. One task = one concern.
2. End every prompt with an explicit output contract: "Your final message must contain ONLY: …".
3. For multi-artifact work, split into parallel micro-tasks (tiny prompts with no skills complete reliably).
4. Rightsize skill injection: specify skills only when the task genuinely needs their domain knowledge.

## Pitfall: prescribe the outcome, not the method

Prescribing exact commands or tool recipes in a delegation prompt (specific gh/API calls to fetch a CI run, specific git invocations) burns subagent budget when the permission layer denies them or they are unavailable - the subagent then improvises workarounds instead of doing the task. Operator correction: stop telling the agent how to do things; it must figure out what to do from its skill. Source: operator-corrected CI-fix delegation, 2026-09-16 (mem:cases/ci-run-34774864071-gate-merge).

**Rule:** state GOAL, SCOPE, ACCEPTANCE CRITERIA, and CONSTRAINTS; the subagent owns the METHOD, guided by its loaded skills. Include an exact command only when the operator requires that command specifically.