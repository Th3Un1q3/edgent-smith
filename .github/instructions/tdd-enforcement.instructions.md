---
name: tdd-enforcement
description: "Use when: implementing any code change, feature, or bugfix. This instruction enforces strict Test-Driven Development (TDD) with no exceptions."
applyTo: "**/*.{ts,js,py}"
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