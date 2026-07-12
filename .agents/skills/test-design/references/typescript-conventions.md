# TypeScript Testing Design

## Existing Testing Infrastructure

Vitest is the primary test runner for TypeScript tests in the codebase.

## Automated Quality Gates

Quality gates are configured in the project and described in the closest AGENTS.md file. Use them to run checks over using direct commands.

```bash
## Good: run complete test suite
just test

## Good: run specific test suite
just test plugins/tests/instructions-loader.test.ts # Runs with project utils and pre-configured test infrastructure

## Avoid using non cannonical commands that bypass project utils and pre-configured test infrastructure

## Bad
bun run vitest # Any command that you write can miss to use project utils and pre-configured test infrastructure

## Bad
bun test plugins/tests/instructions-loader.test.ts

## Bad
npx vitest plugins/tests/instructions-loader.test.ts

## Bad
npm run test
```

## Structure of Test Files

Concrete patterns for vitest test files. Each example maps one-to-one against a principle in [general-principles.md](./general-principles.md). Use these as your reference whenever writing or reviewing TypeScript tests.

## Principle 1: Named Arguments

Use object parameters for all function calls under test. Never rely on positional order.

```ts
// BAD — position-dependent, unclear intent
createUser("alice", 30, "admin")

// GOOD — self-documenting, resilient to signature changes
const user = createUser({ name: "alice", age: 30, role: "admin" })
expect(user).toHaveProperty("id")
```

## Principle 2: Table-Driven Tests (Object Table)

Define each scenario as an object with descriptive keys. Use native `it.each(table)` or `describe.each(table)` with an array of objects so vitest passes each row's properties directly to the test callback. Use table-driven tests when only a few variables change across scenarios; for complex per-case setup, write separate `it()` blocks instead.

**When table-driven tests fail:** For integration/fixture-based tests where each scenario requires distinct shared-state setup (not just different input values), write separate `it()` blocks with inline setup in `beforeEach`. Consolidate into a table only when the number of scenarios exceeds 8 and each differs by one variable. Use tables for unit tests with mocked dependencies; use separate blocks for integration tests with fixtures or shared state.

```ts
import { describe, it, expect } from "vitest"

describe("toUpperCase()", () => {
  // Keep table rows small and close to the test body.
  const cases = [
    { name: "lowercase",   input: "hello", expected: "HELLO" },
    { name: "empty",       input: "",      expected: "" },
    { name: "mixed case",  input: "AbC",   expected: "ABC" },
  ]

  it.each(cases)("converts $name to uppercase", ({ input, expected }) => {
    expect(typeof input).toBe("string")
    const actual = (input as string).toUpperCase()
    expect(actual).toBe(expected)
  })
})
```

Using describe.each for situation when similar tests need to be executed in different contexts. This is useful when you want to test the same functionality with different configurations or setups.

```ts
describe('agentIndex()', () => {
  const subject = (agentConfig) => agentIndex({ agent: agentConfig.agent })

  beforeEach(() => {
    registerAgent('someRootLevelDefaultAgent')
  })

  const agents = [
    { agent: "default", skipDays: 10, expectStorage: expect.anything() },
    { agent: "copilot", skipDays: 30, expectStorage: expect.not.anything() },
  ]
  describe.each(agents)('when agent is $agent', (agentConfig) => {
    beforeEach(async () => {
      // This before each block allows to setup multiple similar environments and keep setup code separate from test code
      registerAgent(agentConfig.agent)
      simulateTimeTravel(agentConfig.skipDays) // Simulate time travel to test caching behavior
    })

    it('returns the cache value for the agent', () => {
      const result = subject(agentConfig)
      expect(result).toEqual(agentConfig.expectStorage)
    })

    it('returns correct registeredDays', () => {
      const result = subject(agentConfig)
      expect(result.registeredDays).toEqual(agentConfig.skipDays)
  })
})
```

## Principle 3: No Conditionals Inside Test Bodies

Test bodies are straight-line only. If you reach for `if`, `else`, ternaries, or `switch`, split the scenario into separate table rows or separate `it()` cases.

```ts
// GOOD — each branch is a row in the table above

it('handles active status as true' , () => {
  const activeStatus = activeUser.status
  expect(getStatus(activeStatus)).toBe(true)
})

it('handles inactive status as false', () => {
  const inactiveStatus = inactiveUser.status
  expect(getStatus(inactiveStatus)).toBe(false)
})


// BAD — conditional hides which branch executed on failure
it("handles various statuses", () => {
  const status = getRandomUser().status

  // This only allows one branch to be tested per run, and hides which branch failed on assertion failure
  if (status === "active") {
    expect(getStatus(status)).toBe(true)
  } else {
    expect(getStatus(status)).toBe(false)
  }
})
```

## Principle 4: Effective Mocking Patterns

Follow this pattern exactly: vitest hoists `vi.mock()` calls to file top at parse time, so inline mock configuration creates unpredictable module state — configure in shared hooks instead.

1. `vi.mock("dep")` at file top — auto-generates stubs (vitest hoists these)
2. Import from the mocked module **after** `vi.mock()` calls — uses the stub, not real impl
3. Configure mock return values in the nearest ancestor's `beforeEach`, **never inside individual tests**
4. Use nested contexts to override specific behaviors — each layer configures only what differs from its parent

```ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import type { Mock } from "vitest"

// Step 1: declare mocks at file top (vitest hoists these automatically)
// DON'T mock inline behavior here as it will be lost when vitest resets all mock behavior between tests
vi.mock("../features/db")
vi.mock("../features/email-service")
vi.mock("../dynamic-function")

// Step 2: import stubs — must come AFTER vi.mock() calls
import * as auth from "../src/features/auth"
import { db } from "../src/features/db"
import { EmailService } from "../dynamic-function"
import type { Mock } from "vitest"

describe("auth", () => {
  // Declare a typed mock without any behavior here. Behavior is reset between tests, so configure it in beforeEach() instead.
  const sendEmailMock = vi.fn() as Mock<typeof auth.sendEmail>
  let user: { id: number; name: string; email: string } | null = null

  // Root beforeEach: every test inherits this baseline
  beforeEach(() => {
    user = { id: 1, name: "Alice", email: "alice@example.com" }

    // Assign behavior to the automocked module stubs. At this point mock has no behavior, so we configure it here.
    (db.query as Mock).mockResolvedValue([user]) // baseline: returns a user for all tests

    sendEmailMock.mockResolvedValue(true)

    (EmailService as Mock<EmailService>).mockImplementation(() => ({
      sendEmail: sendEmailMock,
    }))

    // setup spies on the top level
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  it("returns user profile when found", async () => {
    const result = await auth.getProfile({ userId: 1 })
    expect(result).toEqual(expect.objectContaining({ id: 1, name: "Alice" }))
  })

  it("sends email when reset password is called", async () => {
    const user = await auth.getProfile({ userId: user!.id })

    expect(user).not.toBeNull()
    expect(user).toEqual(expect.objectContaining({ email: user!.email }))

    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: user!.email }))
  })

  describe("when query returns empty", () => {
    beforeEach(() => {
      (db.query as Mock).mockResolvedValue([]) // override only what differs
    })

    it("returns null when not found", async () => {
      const result = await auth.getProfile({ userId: 99 })
      expect(result).toBeNull()
    })

    it("logs a warning on empty result", async () => {
      await auth.getProfile({ userId: 99 })
      expect(console.warn).toHaveBeenCalledWith("No profile found for user 99")
    })
  })

  describe("when query throws", () => {
    beforeEach(() => {
      (db.query as Mock).mockRejectedValue(new Error("db timeout"))
    })

    it("returns fallback profile on error", async () => {
      const result = await auth.getProfile({ userId: 99 })
      expect(result).toEqual({ id: -1, name: "unknown" })
    })
  })
})
```

Never initiate repetitive spies or mocks inside individual tests. Always configure them in the nearest ancestor's `beforeEach` so that they are reset between tests. This ensures that each test runs in isolation and does not depend on the state left by previous tests. 

### Pattern Selection Guide (Principle 4)

| Scenarios | Pattern | Nesting depth |
|---|---|---|
| ≤3, different mock values | Nested `describe` → `beforeEach` override per layer | Up to 2 levels (root + child) |
| 4–8, some share behavior | Root `beforeEach` baseline → nested overrides only diffs | Up to 3 levels |
| >8 with distinct configs | Separate it blocks — inline mock setup per test | No nesting |
| Complex shared state across tests | Extract helper function called from `beforeEach` | N/A |

**DO NOT nest when:** each test needs fundamentally different mock implementations (not just return values) or child would need >2 overrides. Use separate it blocks with inline config instead — 3+ levels of nesting is more fragile than a flat structure.


## Principle 5: Minimalistic Assertions leveraging built-in matchers

Always use built-in matchers to communicate intent. Avoid custom counters or manual tracking of calls, as they obscure the intent of the test and make it harder to understand what is being verified. Use matchers like `toHaveBeenCalledTimes` and `toHaveBeenCalledWith` to clearly express the expected behavior of mocks.

```typescript
// BAD: use custom counters instead of built-in matchers
it('should be called once', async () => {
  const counter = 0
  mockFn.mockImplementation(() => counter++)
  await performAction()
  expect(counter).toBe(1)
  const name = mockFn.mock.calls[0][0].name
  expect(name).toBe("expectedArg")
})

// GOOD: use built-in matchers to communicate intent
it('should be called once', async () => {
  // Confirm that there is no chace that the mock was called before the action by some other test or setup code
  expect(mockFn).not.toHaveBeenCalled()
  await performAction()
  expect(mockFn).toHaveBeenCalledTimes(1)
  expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({ name: "expectedArg" }))
})
```

Use native matchers to track errors and async errors. Avoid custom error counters or manual tracking of errors, as they can lead to confusion and make it harder to understand what is being verified. Use matchers like `toThrow` and `rejects.toThrow` to clearly express the expected behavior of functions that may throw errors.

```typescript
// BAD: use custom error counters instead of built-in matchers
it('should throw an error', async () => {
  let errorMessage = ""
  try {
    await performAction()
  } catch (error) {
    errorMessage = (error as Error).message
  }
  expect(errorMessage).toBe("expected error message")
})

// BAD: manual try/catch with assertions inside the catch block
it('should throw an error', () => {
  try {
    performSyncAction()
    fail("Expected error was not thrown")
  } catch (error) {
    expect((error as Error).message).toBe("expected error message")
  }
})

// GOOD: use built-in matchers to communicate intent
it('should throw an error', async () => {
  await expect(performAction()).rejects.toThrow("expected error message")
})

// GOOD: use built-in matchers for synchronous functions
it('should throw an error', () => {
  expect(() => performSyncAction()).toThrow("expected error message")
})
```

### Fixture-Driven Tests (Integration / Shared-State Setup)

The rules above apply to **mock-driven** tests where `vi.mock()` controls module imports. For **fixture-driven** integration tests where each scenario requires distinct shared-state setup (e.g., constructing index fixtures, loading data from files), the pattern shifts: configure state in a root `beforeEach` and override only what differs in nested hooks. Scenario-based describe naming is acceptable when it communicates behavioral boundaries rather than test cases.

```ts
// Acceptable — scenario names communicate behavioral boundaries
describe('createIndex().forFiles', () => {
  let subject: Index // Define subject at the top so all nested contexts can access it
  beforeEach(async () => {
    subject = await createIndex({ /* shared fixture setup */ })
  })

  describe('when instruction has excludePaths property', () => { ... })
  describe('when instructions have global frontmatter', () => {} )
})
```

## Principle 5: One Assert Per Scenario, Group by Unit Under Test

Name `describe()` blocks after the module or class under test. Each inner `it()` covers one distinct input-output relationship. Do not name describe blocks after test scenarios ("when login succeeds") — name them after what is being tested ("auth service"). **Exception:** for fixture-driven integration tests where nested describes communicate behavioral boundaries (not individual test cases), scenario-based names are acceptable when they help readers understand *which* behavior the block validates.

```ts
describe('email', () => {
  // assert similar fields, behavior that works together, or a single input-output relationship
  it('sends email with correct subject, to and body', () => { ... })
  it('marks email as sent in the database', () => { ... })
  it('uses sender address as configured in the settings', () => { ... })
  it('sends a copy to the cc list', () => { ... })
  // We don't need to say "when send is successful" as root describe is always a green path scenario.
  it('does not create a record in DLQ', () => { ... })

  describe('when email service is down', () => {
    it('creates a record in DLQ', () => { ... })
    it('does not mark email as sent in the database', () => { ... })
  })

  describe('when more than 10 cc recipients are provided', () => {
    it('throws an error', () => { ... })
    it('does not send the email', () => { ... })
    it('marks the email as failed in the database', () => { ... })
  })

  describe('when recipient is in blocklist', () => {
    it('does not send the email', () => { ... })
    it('marks the email as blocked in the database', () => { ... })
  })
})
```

---

## Anti-Pattern: Using inline imports/requires


Inline imports are negatively impacting readability, test isolation, they produce duplicates and have no advantages over file-top imports. They should be avoided in test files.


```typescript
// GOOD: import at file top

import { myFunction } from './myModule';

// Use imported function(even if it is mocked with automock)

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction(1);
    expect(result).toBe(true);
  });

  it('should do something else', () => {
    const result = myFunction(2);
    expect(result).toBe(false);
  });
});

// BAD: inline import inside test body
describe('myFunction', () => {
  it('should do something', async () => {
    const module = await import('./myModule'); // Inline import inside test body
    const result = module.myFunction(1);
    expect(result).toBe(true);
  });

  it('should do something else', async () => {
    const module = await import('./myModule'); // Inline import inside test body
    const result = module.myFunction(2);
    expect(result).toBe(false);
  });
});
```

## Anti-Pattern: Clearing and reseting mocks by hand

Infrastructure already clears and resets mocks between tests. Clearing and resetting mocks by hand is unnecessary and can lead to confusion and errors. It should be avoided in test files. 

```typescript
// GOOD: no manual clearing or resetting of mocks
describe('myFunction', () => {
  beforeEach(() => {
    // Setup custom mock behavior here if needed
  })
})

// BAD: manually clearing and resetting mocks
describe('myFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Manually clearing mocks
    vi.resetAllMocks(); // Manually resetting mocks
    vi.mocked(sessionHelpers.sendMessage).mockClear() // No need
  });
})

```

## Anti-Pattern: Excessive Type Assertions (`as any`)

Every `as any` in a test file is a red flag that should be counted and addressed during code review. Production-quality tests should use typed mocks (`Mock<T>` from vitest or `vi.fn<T>()`) instead of type assertions to preserve compile-time safety on mock signatures. An `as any` silences type errors from mock configuration mistakes, masks incorrect property access, prevents IDE autocomplete, and compounds maintenance debt over time.

### Detection Rule (Code Review)

Count all `as any` occurrences in the test file:
1. For each instance, verify the mock actually returns the correct type
2. Replace with proper typing: use `Mock<T>` from vitest or `vi.fn<T>()` to generate typed mocks
3. If a genuine case for suppression exists, add a comment explaining why the real type cannot be used

## Anti-Pattern: Oversized it Blocks (Scope Creep)

A single `it()` block exceeding 50 lines of *execution code* (excluding setup) is scope creep. Such blocks often combine input variations that should be separate table rows, making it hard to locate which specific scenario caused a failure. Count distinct `expect()` calls — 3+ without a clear setup→act→assert chain suggests different concerns collapsed into one test.

### Detection Heuristic & Enforcement

- **1–2 expects:** acceptable for one scenario
- **3+ expects** in one block without a clear chain: likely scope creep — each expect verifies a different concern
- **50-line execution code threshold:** split into table-driven rows or separate `it()` blocks
- **150-line it block total:** requires reviewer approval before merging; often combines multiple scenarios collapsed to avoid "test sprawl"

### The Scope Creep Cost

| Metric | Impact of 150+ line it block |
|---|---|
| Average time to locate failure context | 4–7 minutes (reader must re-read entire block on every failure) |
| Mock configuration changes needed per new scenario | Requires editing the existing block instead of adding a new row — merge conflicts compound |
| Test isolation quality | Zero — failures in one assertion prevent execution of all subsequent assertions in the same block |
