---
description: Instructs on how to run quality checks.
applyTo: ".opencode/**/*.{ts,js,json}"
excludeAgents: "rug"
---

# Manual run of quality gates

> By default the quality gates trigger automatically on relevant files changes, and report the results in the chat. However, you can also run the quality gates manually to check the status of your plugin.

Always ensure the following when developing Opencode plugins:

From the '.opencode' directory, run the following commands to ensure that the plugin is working correctly:

```bash
just test
just test --coverage
just test -- plugins/tests/skills-loader.test.ts
just lint
just typecheck

# Run entire mutation test suite - has a long runtime, so only run for final verification before release
just mutation
# Run mutation tests to ensure the plugin is well tested
just mutation --mutate plugins/todo-enforcer.ts
```

NEVER call underlying implementation commands directly (eg. `pytest`, `npm test`, `vitest`, `bun`, `tsc`) — always use the above commands to ensure that the plugin is tested, linted, and typechecked in the same way as it will be in production.

## Per-File Verification is Mandatory

1. **Verify each file as you finish it** — after editing a file, run the relevant per-file check (e.g., `just test -- <path-to-file>`, or lint/typecheck scoped to that file) BEFORE moving on to the next file. Do NOT defer verification to the end of the task.
2. **Verification is not optional** — a file is not done until its check passes, or the failure is explicitly documented. Verification is part of "done", not a follow-up.
3. **Budget for it** — per-file verification consumes tool calls. Account for it against the advertised `<task-budget tool-calls="N" />` and reserve calls for verification. If the budget is too tight to verify everything, verify the most critical subset and explicitly report which files were NOT verified and why.

### Handling Quality Gate Failures

When a quality gate (lint, test, typecheck) reports failures in a `<steering>` block:

1. **Read ALL failure details** — examine each error message, not just the pass/fail status.
2. **Fix in-scope failures** — if the failures are in files you've modified or are related to your changes, fix them before declaring the task complete.
3. **Document out-of-scope failures** — if the failures are pre-existing or in files outside your task scope, explicitly acknowledge them in your response and explain why they're not being fixed (e.g., "The 2 ESLint errors in session-helpers.ts and quality-gate-enforcer.ts are pre-existing and outside the scope of this fix.").
4. **Never silently ignore** — always acknowledge quality gate failures. A silent disposition lets technical debt accumulate across sessions without visibility.
