# Reference: Red-Green-Refactor Cycle Details

The complete TDD cycle broken down into its three phases with detailed guidance, common pitfalls, and verification criteria for each step. This reference supplements the workflow files — use it when you need deeper explanation of a specific phase.

## Phase 1: RED — Write Failing Test

### Purpose

Define exactly what behavior should exist before that behavior exists in production code. The test is the first specification.

### What Makes a Good Red Test

| Criterion | Description |
|---|---|
| **One behavior** | Tests a single, specific outcome. If the name contains "and", split it. |
| **Descriptive name** | States what is tested: `test('rejects empty email')` not `test('test1')`. |
| **Real inputs** | Uses actual data values, not mocks or stubs (unless mocking is unavoidable). |
| **Clear assertions** | Asserts on observable outcomes: return value, state change, error thrown. |

### Common Red Test Anti-Patterns

```typescript
// ❌ Tests mock behavior, not real behavior
test('calls validateEmail', () => { ... }); // verifying a call is not testing outcome

// ❌ Vague name — doesn't state what's tested
test('works correctly', () => { ... });

// ❌ Tests multiple behaviors at once
test('validates form completely and handles errors and saves to db', () => { ... });

// ❌ Asserts on implementation details instead of behavior
expect(mock.validateEmail).toHaveBeenCalled(); // how vs what
```

### Verification: Is Your Test Ready to Fail?

Run the test in isolation. It **must** fail with these conditions:

1. **Failure (not error)** — Assertion fails, not an unhandled exception or syntax error
2. **Expected message** — The failure output matches "this feature is missing"
3. **Right cause** — Fails because the production code doesn't implement this yet, not because of typos or wrong imports

Read run commands from [running-tests-commands.md](./running-tests-commands.md). Do not guess; always read the reference first.

## Phase 2: GREEN — Write Minimal Code

### Purpose

Implement **only** what the current failing test requires. Nothing more, nothing less.

### The Minimalism Principle

| Do | Don't |
|---|---|
| Write just enough to make this one test pass | Add "just in case" logic for future scenarios |
| Use the simplest possible implementation | Apply design patterns prematurely |
| Handle only the current test's assertion | Add error handling for untested edge cases yet |
| Write a concrete solution | Abstract into interfaces or base classes yet |

### Common Green Phase Anti-Patterns

```typescript
// ❌ Wrote validation for name, phone, address too — the test didn't ask for it
function submitForm(data) {
  if (!data.email?.trim()) return { error: 'Email required' };
  if (!data.name?.trim()) return { error: 'Name required' }; // YAGNI — not tested yet
}

// ❌ Added configuration options the test didn't require
function retryOperation(fn, maxRetries = 3, backoff = 'linear') { ... }
// The first test only needs: function retryOperation(fn) { return fn(); }

// ❌ Refactored unrelated code "while I'm here"
// Stay focused. One behavior → one test → minimal implementation.
```

### Verification: Did You Pass the GREEN Test?

Run your full suite after adding production code:

1. **New test passes** — The specific test driving this iteration succeeds
2. **All existing tests still pass** — No regressions introduced
3. **Output is clean** — No lint errors, no warnings, no deprecations

Read run commands from [running-tests-commands.md](./running-tests-commands.md). Do not guess; always read the reference first.

## Phase 3: REFACTOR — Clean Up

### Purpose

With all tests green, improve code quality without changing behavior. This is where you make both subject code and test code more maintainable.

### What to Refactor in the Subject Code

- Remove duplication (extract shared functions)
- Improve naming for clarity
- Simplify complex conditionals
- Break up large functions
- Improve type safety

### What to Refactor in Test Code

- Extract repeated setup into shared fixtures/helpers
- Group related test cases under descriptive contexts
- Replace inline data with named constants or builders
- Consolidate overlapping assertions into helper functions

### Constraints on Refactoring

1. **Never add behavior** — Every line must clarify existing code, not introduce new functionality
2. **Stay green** — Run full suite after every refactoring change
3. **Small steps** — One change at a time, verify it passes before the next change

### Common Refactoring Anti-Patterns

```typescript
// ❌ Added a config parameter "while refactoring" — new behavior disguised as cleanup
function validateEmail(email, options = { requireTld: true }) { ... }
// The test didn't ask for this. Remove it.

// ❌ Extracted to 4 levels of indirection "for extensibility"
// Refactor for clarity of the current code, not hypothetical future needs
```

## Red Flags — STOP and Start Over

If you encounter any of these during a TDD cycle, stop immediately:

| Red Flag | What It Means | Action |
|---|---|---|
| Test passes before writing production code | Testing existing behavior or test is wrong | Revise test to target unimplemented behavior |
| Can't explain why the test failed | Didn't watch it fail properly | Run again, observe failure, proceed only when you can explain it |
| Wrote more than 5 lines of production code in one GREEN step | Probably adding untested features | Revert, write minimal amount needed for this test only |
| Test uses mocks to assert on calls rather than outcomes | Testing implementation not behavior | Rewrite to assert observable results instead |
| Added error handling the test didn't require | Adding "just in case" code | Remove — handle it when a test demands it |

## Quick Reference: Full Cycle Checklist

```
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
  [ ] Every box checked above before proceeding to next test
```

## When Tests Are Hard to Write

| Problem | Guidance |
|---|---|
| Can't figure out how to test it | The interface may be unclear. Design the API you wish existed, then write the test against that API. Ask your human partner if stuck. |
| Need too many mocks | Code is tightly coupled. Apply dependency injection or restructure so the subject has fewer direct dependencies. |
| Test setup takes longer than the test itself | Extract shared fixtures into a dedicated helper file. If still long, the interface may be overcomplicated. |
| Can't identify what to assert on | Look at what changes: return value, state, side effect (file written, network call made). Assert on that observable change. |
