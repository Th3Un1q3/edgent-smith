---
name: test-driven-development
description: >
  Strict TDD workflow for every feature or bugfix, all languages. Load the appropriate workflow from this skill — create a new test suite (scaffold then one-by-one), modify existing tests, or get refactoring suggestions. Never write production code before a failing test proves it necessary. Use when implementing features, fixing bugs, adding behavior, or improving existing code with TDD. Trigger on: "implement X", "fix bug Y", "add test-driven development", "TDD this", "write tests first", any feature/bugfix request where test-first discipline applies.
license: MIT
compatibility: Requires OpenCode
metadata:
  version: "2.1.1"
  delta: "2.1.1 — replaced the AP-number anti-pattern split with two cause files (testing-anti-patterns-mocks.md, testing-anti-patterns-lifecycle.md); moved red flags and destination content out of the deleted -closing grab-bag and refactor-and-red-flags.md; added the REFACTOR phase to red-green-refactor.md; added cycle-red-flags-and-checklist.md and handling-common-problems.md; all files routed."
---

# Test-Driven Development (TDD)

Write the test first. Watch it fail for the right reason. Write minimal code to pass. Repeat.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

Follow the relevant [workflow](#task-routing-table), avoid anti-patterns, and use project specific commands to run tests. See the [references](#references-load-as-needed) section for details.

## When to Use

**Always apply TDD for:**
- New features and behavior
- Bug fixes (write failing regression test first)
- Refactoring existing code
- Any production code changes

**Exceptions — ask your partner before skipping:**
- Throwaway prototypes
- Configuration files
- Types declarations

Thinking "skip TDD just this once"? That's rationalization. No exceptions without explicit permission.

## The Iron Law

`!NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST!`

Write code before the test? Delete it. Start over. Don't keep it as "reference" or "adapt" it while writing tests. Delete means delete — implement fresh from tests only.

## Task Routing Table

Identify your entry point below and load the corresponding workflow file:

| Your situation | Load this workflow |
|---|---|
| Creating a **new** test suite (first time) | [workflows/scaffold.md](./workflows/scaffold.md) — create scaffold, then implement one-by-one |
| Implementing tests **one at a time** after scaffold exists | [workflows/one-by-one.md](./workflows/one-by-one.md) — fail → minimal code → pass → refactor cycle |
| Need to decide: modify existing tests or create new ones? | [workflows/modify-existing.md](./workflows/modify-existing.md) — decision guide for test reuse vs. creation |
| Want refactoring suggestions for tests or subject code | [workflows/refactor-suggestions.md](./workflows/refactor-suggestions.md) — find duplicates, group cases, improve structure |

## References (load as needed)

| Topic | File |
|---|---|
| Testing anti-patterns caused by mocks — mock behavior, mocking without understanding, incomplete or over-complex mocks | [references/testing-anti-patterns-mocks.md](./references/testing-anti-patterns-mocks.md) |
| Testing anti-patterns caused by the test lifecycle — test-only production code, tests as afterthought | [references/testing-anti-patterns-lifecycle.md](./references/testing-anti-patterns-lifecycle.md) |
| Red-Green-Refactor cycle details — all three phases with verification for each | [references/red-green-refactor.md](./references/red-green-refactor.md) |
| Cycle red flags to stop on, and the full-cycle checklist | [references/cycle-red-flags-and-checklist.md](./references/cycle-red-flags-and-checklist.md) |
| Handling hard-to-test code, over-mocking, slow setup, and unclear assertions | [references/handling-common-problems.md](./references/handling-common-problems.md) |
| Project-specific commands to run tests (Python project, OpenCode plugins) | [references/running-tests-commands.md](./references/running-tests-commands.md) |
| Designing complete test cases — ZOMBIES mnemonic (use for scaffold and extending test suites) | [references/zombie-test-design.md](./references/zombie-test-design.md) |

## Verification Checklist

Before marking work complete:

- [ ] Every new function/method has a test that failed first
- [ ] Each test failed for the expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test — no extra features
- [ ] All tests pass; output is clean (no errors, warnings)
- [ ] Tests use real code — mocks only when unavoidable
- [ ] Edge cases and error paths covered

Can't check all boxes? You skipped TDD. Start over.

## Common Rationalizations — STOP

These mean: delete code, start over with TDD:

- Code written before test
- Test passes immediately (proves nothing)
- "I'll write tests after"
- "Already manually tested the edge cases"
- "Deleting X hours of work is wasteful" (sunk cost fallacy)
- "TDD is dogmatic, I'm being pragmatic"
- "Keep as reference" or "adapt existing code"
- "Tests after achieve the same purpose"

All of these = delete. Start over. No exceptions without your human partner's permission.

## Debugging Integration

Found a bug? Write a failing test reproducing it first. Follow TDD cycle. The test proves the fix and prevents regression. Never fix bugs without a test.
