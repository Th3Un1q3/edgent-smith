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