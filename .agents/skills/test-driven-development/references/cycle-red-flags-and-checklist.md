# Reference: Cycle Red Flags and Checklist

Use this when you need the stop signals and the end-to-end checklist for one TDD iteration.

## Red Flags — STOP and Start Over

If any of these appear during a cycle, stop immediately:

| Red flag | What it means | Action |
|---|---|---|
| Test passes before writing production code | Testing existing behavior, or the test is wrong | Revise the test to target unimplemented behavior |
| Can't explain why the test failed | Didn't watch it fail properly | Run again, observe the failure, proceed only when you can explain it |
| Wrote more than 5 lines of production code in one GREEN step | Probably adding untested features | Revert; write the minimal amount for this test only |
| Test uses mocks to assert on calls, not outcomes | Testing implementation, not behavior | Assert observable results instead |
| Added error handling the test didn't require | Adding "just in case" code | Remove it; handle it when a test demands it |

## Quick Reference: Full Cycle Checklist

```text
RED:
  [ ] Test name describes one specific behavior
  [ ] Uses real inputs (no mocks unless unavoidable)
  [ ] Contains clear assertions on expected outcome
  [ ] Runs and FAILS for the right reason

GREEN:
  [ ] Production code is minimal — only what this test requires
  [ ] No "just in case" logic or future-proofing added
  [ ] Test passes (not just errors cleanly)
  [ ] All other tests still pass (no regressions)

REFACTOR:
  [ ] Removed duplication in subject and/or test code
  [ ] Improved naming and structure without changing behavior
  [ ] All tests still pass after every change made
  [ ] No new features or capabilities added

Full cycle:
  [ ] Every box checked above before proceeding to the next test
```
