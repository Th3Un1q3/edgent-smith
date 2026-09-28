# Reference: Red-Green-Refactor Cycle

The complete TDD cycle: three phases with purpose, pitfalls, and verification for each. Use it when you need deeper explanation of a phase than the workflow files give.

## Phase 1: RED — Write the Failing Test

Define exactly what behavior should exist before it exists. The test is the first specification.

| Good Red test | Criterion |
|---|---|
| One behavior | Tests a single outcome. If the name contains "and", split it. |
| Descriptive name | States what is tested: `test('rejects empty email')`, not `test('test1')`. |
| Real inputs | Uses actual data, not mocks or stubs unless mocking is unavoidable. |
| Clear assertions | Asserts on observable outcomes: return value, state change, error thrown. |

Common Red anti-patterns:

```typescript
test('calls validateEmail', ...)                // ❌ verifies a call, not an outcome
test('works correctly', ...)                    // ❌ vague name
expect(mock.validateEmail).toHaveBeenCalled();  // ❌ asserts on implementation
```

**Verification — is your test ready to fail?** Run it in isolation. It must fail with:

1. **Failure, not error** — an assertion fails, not a syntax error or unhandled exception.
2. **Expected message** — the output says the behavior is missing.
3. **Right cause** — it fails because production code lacks the behavior, not a typo or bad import.

Read run commands from [running-tests-commands.md](./running-tests-commands.md); do not guess.

## Phase 2: GREEN — Write Minimal Code

Implement only what the current failing test requires. Nothing more.

| Do | Don't |
|---|---|
| Write just enough for this one test | Add "just in case" logic for future scenarios |
| Use the simplest implementation | Apply design patterns prematurely |
| Handle only the current assertion | Add untested error handling yet |
| Write a concrete solution | Abstract into interfaces or base classes yet |

Common Green anti-patterns:

```typescript
function submitForm(data) {
  if (!data.email?.trim()) return { error: 'Email required' };
  if (!data.name?.trim()) return { error: 'Name required' }; // ❌ untested, YAGNI
}
function retryOperation(fn, maxRetries = 3, backoff = 'linear') { ... } // ❌ needed: (fn)
// ❌ refactoring unrelated code "while I'm here"
```

**Verification — did you pass the GREEN test?**

1. **New test passes** — the test driving this iteration succeeds.
2. **All existing tests pass** — no regressions.
3. **Output is clean** — no lint errors, warnings, or deprecations.

## Phase 3: REFACTOR — Clean Up

With all tests green, improve quality without changing behavior. Refactor both subject code and test code.

**Subject code:** remove duplication, improve naming, simplify conditionals, break up large functions, improve type safety.

**Test code:** extract repeated setup into fixtures or helpers, group cases under descriptive contexts, replace inline data with named constants or builders, consolidate overlapping assertions.

**Constraints:**

1. **Never add behavior** — every line clarifies existing code; it does not add functionality.
2. **Stay green** — run the full suite after each change.
3. **Small steps** — one change at a time, verify it passes before the next.

Common Refactor anti-patterns:

```typescript
function validateEmail(email, options = { requireTld: true }) { ... } // ❌ new behavior as "cleanup"
// ❌ four levels of indirection "for extensibility"
```

**Verification — did you refactor without drift?**

1. **All tests still pass** after every change.
2. **Behavior is unchanged** — no new inputs, outputs, or side effects.
3. **Subject and test code are clearer** than before.
