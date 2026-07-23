---
name: tdd-enforcement
description: "Follow it when: implementing any code change, feature, or bugfix. This instruction enforces strict Test-Driven Development (TDD) with no exceptions."
applyTo: "**/*.{ts,js,py}"
excludePaths: "**/*.test.ts,tests/*.py"
---

# TDD Enforcement: The Iron Law

You must follow Test-Driven Development (TDD) for **every** code change; do not bypass it for "simple" fixes or "obvious" logic.

## The Workflow

1.  **RED**: Write the simplest test case that demonstrates the bug or defines the feature clearly, focusing on a single behavior or condition.
2.  **VERIFY**: Run the test and confirm it **fails** for the expected reason (this verifies the test reproduces the issue).
3.  **GREEN**: Implement only the code necessary to make the test pass; avoid adding unrelated functionality.
4.  **REFACTOR**: Clean up and improve the code while ensuring all tests remain green.

## Mandatory TDD Constraints

These rules support the core TDD workflow above. Follow them in order, with the first rule as the highest priority.

### Priority 1: Strict Sequence
If you modify implementation code before writing a failing test:
1.  **STOP** immediately.
2.  **ROLLBACK** or discard the implementation changes and return to the last known good state.
3.  **WRITE** the failing test first.
4.  **PROCEED** only after the test fails when run.

Example: If you find a bug, do not change the implementation before creating a focused test that reproduces the failure.

### Constraint 2: Reliable Verification
- Use the project's test runner (e.g., `just test`, `pytest`, `npm test`) and run tests through it.
- If a change spans multiple files or modules, ensure tests cover the behavior across those boundaries.
- Never assume a test will fail; run it and observe the failure directly.

### Constraint 3: Avoid Antipatterns
Avoid the following practices, as they violate TDD principles:
 - Creating or modifying implementation files before writing a failing test.
 - Writing tests only after the implementation is complete.
 - Changing implementation code to make a test pass without first writing a failing test.
 - Skipping tests for "trivial" changes.

## Constraint 4: Debug Artifact Cleanup

After completing a RED → GREEN → REFACTOR cycle, you MUST remove all debug artifacts before considering the work done. Debug artifacts are temporary code added during development that serve no purpose in the final implementation.

### What to Remove

| Artifact | How to Detect | Why It Must Go |
|----------|--------------|----------------|
| `console.log()` / `console.debug()` calls | `grep -rn "console\.\(log\|debug\|warn\)"` in changed files | Pollutes output, leaks implementation details |
| Temporary debug test files | `ls *_debug*.test.ts`, `ls __debug*` | Adds noise to test suite, may fail in different environments |
| Commented-out code | `grep -rn "//.*\(DEBUG\|TEMP\|HACK\|FIXME\)"` in changed files | Clutters codebase, hides intent |
| Test-only mock spy logs | `vi.fn().mockImplementation((...args) => { console.log(...); return ... })` | Debug instrumentation that doesn't test behavior |

### Cleanup as a Gate

Before running the final quality gates (`just test`, `just lint`, `just typecheck`), run a self-check:

```bash
# Check for console.log in changed source files (not test files)
grep -rn "console\.\(log\|debug\)" plugins/ --include="*.ts" --exclude="*.test.ts"

# Check for debug test files
ls plugins/tests/__debug* 2>/dev/null
```

If either check returns results, remove the artifacts before proceeding.

### Anti-Patterns

- Leaving `console.log` calls with `[DEBUG]` prefix "so I can find them later" — they will never be found later. Remove them now.
- Creating `__debug*.test.ts` files to isolate a test scenario — extract the scenario into the real test file or remove the debug file.
- Commenting out code "in case we need it" — version control remembers; delete it.