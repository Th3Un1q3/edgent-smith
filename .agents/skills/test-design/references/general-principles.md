# General Testing Principles

Language-agnostic rules that apply to every test file in the codebase regardless of language or framework. Each principle includes a rationale so you understand why it matters, not just what to do.

## Structural Limits (Pre-Read)

These limits apply to every test file regardless of language or framework. Violating them is itself an anti-pattern that the skill flags before writing begins.

### Test File Conditions

| Condition | Limit | Rationale |
|---|---|---|
| Single test file for one module under test | 150% of the subject size maximum | Subject 200 lines → test file up to 300. This is sufficient buffer for well-scoped tests with good design |
| Nested `describe` blocks within that file | 150 lines per block | A single `describe` block larger than a typical code review session indicates scope creep |
| Individual test body (excluding setup) | 30 lines | Beyond this, the scenario has multiple concerns; split into table rows or separate tests |
| Always one test file per one module under test | Yes | Ensures tests are well-scoped and maintainable |

### When to Extract to Test Helper or Fixture

Extract test code when any of these conditions hold:
- The file exceeds its limit by **any amount** — there is no "close enough" exception
- A single `describe` block contains more than **8 distinct mock configurations** — this indicates the production API couples too many concerns into one testable unit
- Test setup code (mock configuration) exceeds **30% of total file lines** — this signals that either the production module has too many dependencies or the mocks are over-specified

### Anti-Pattern: The Monolith Test File

A test file exceeding 400 lines makes it impossible for reviewers to hold the full mental model simultaneously — split into nested `describe` contexts per behavior group when this threshold is crossed, before applying any other principle in this skill. It fails at its primary purpose of documenting expected behavior because navigation costs exceed comprehension gains.

### Test-to-Implementation Volume Ratio

Final test files should not exceed **150%** of their corresponding implementation file's volume. For example, an implementation with 200 lines of code can have a final test file up to 300 lines. This ratio only applies when the test is complete — during TDD cycles (red-green-refactor), test volume fluctuates significantly as edge cases are discovered and covered. Do not use this ratio to judge incomplete tests or early TDD iterations.

## 0. Never One Shot a Test File

- Implement minimal test scaffold first.
- Place placeholder tests for each scenario you plan to cover (see specific language conventions).
- Run quality gates (linter, type checker, test runner) to ensure the scaffolding is correct.
- Iterate through each scenario, implementing one at a time, validating every change passes quality gates, until all are covered. Do not implement all scenarios in one shot — this is a common anti-pattern that leads to scope creep and unreviewable test files.

## 1. Prefer Named Arguments Over Positional Ones

Use named parameters (keyword arguments, object destructuring) when calling functions under test and configuring fixtures. Never rely on parameter order in test code.

**Rationale:** Tests are read more often than written. Named arguments make intent self-documenting and prevent breakage when source signatures change their parameter order.

## 2. Use Table-Driven Tests for Parameterized Scenarios

When a single function needs to be tested with multiple inputs that produce different expected outputs, define each scenario as a row in a table (array of objects/dicts). Each row describes one input-output pair. Do not use parallel arrays or index-based lookups.

**Rationale:** Object-based tables are self-documenting — field names replace positional comments. Adding a new variable means adding one property, not shifting every column in every existing row.

Use table-driven tests when one to three variables change across scenarios (inputs, expected outputs, edge values). Do not use them for complex setup that differs per case — write separate test blocks instead.

### When NOT to Use Table-Driven Tests (Principle 2)

Do not use table-driven iteration when:
- Any row requires a fundamentally different mock implementation (not just different return values) — inline mock setup inside the loop defeats the purpose of shared hooks
- Assertions differ in structure between rows (one checks existence, another checks value) — these should be separate test blocks or distinct expected values within a single assertion pattern
- More than **8** scenarios with distinct mock configurations — extract to nested describe contexts per behavior group

For complex per-case setup that cannot fit in either table-driven iteration or two levels of nested describe: write separate test blocks. Each block configures its own mocks inline and asserts straight-line. See [TypeScript Conventions](./typescript-conventions.md) for concrete table syntax with your framework.

## 3. No Conditionals Inside Test Bodies

Test bodies must be straight-line: setup → invoke SUT → assert. Never branch with `if`/`else`, ternaries, or switch statements inside a test body. If you find yourself writing conditionals, split each branch into its own table row or separate test case.

**Rationale:** Conditionals hide unexecuted branches and make failures ambiguous — the reader must trace which path an input took to understand why it failed. One scenario = one test case (or one table row).

## 4. Configure Mock Behavior in Shared Hooks, Not Inline

Let your test framework's built-in mock generator create stubs for dependencies at module level. **Always** configure mock return values inside the nearest ancestor's setup hook (`beforeEach`), not inside individual test functions. Use nested contexts (nested `describe`/context blocks) to override specific behaviors — each layer configures only what it needs to change from its parent.

**Rationale:** Configuring mocks inline in every test creates duplication and makes it impossible to see the shared baseline for a context. Setting behavior once in `beforeEach` gives you one source of truth per context, and nested overrides make differences explicit. Mock call counts reset between tests; return values persist until changed by a setup hook.

### The Pattern: Inheritance by Context Nesting

The concept applies across all frameworks. Concrete syntax varies — see [TypeScript Conventions](./typescript-conventions.md#principle-4) for the vitest implementation.

```typescript
// 1. Declare mock stubs at file top (framework-specific syntax)
mock("dep")

// 2. Import from mocked module — gets stub, not real impl
import { dep } from "dep"

describe("auth", () => {                // single root context for this module
  beforeEach(() => {                     // shared setup: every test here inherits this
    dep.query().returns([{ id: 1, name: "Alice" }])
  })


  // All the core green path tests for the module go in top context
  it("returns user profile when found", async () => { ... })

  describe("when query returns empty", () => {  // nested context overrides one behavior
    beforeEach(() => {                     // configure only what differs from parent
      dep.query().returns([])              // only the changed line
    })

    it("returns null when not found", async () => { ... })
    it("logs a warning on empty result", async () => { ... })
  })

  describe("when query throws", () => {   // another nested context, different override
    beforeEach(() => {
      dep.query().throws(new Error("db timeout"))
    })

    it("returns fallback profile on error", async () => { ... })
  })
})
```

### Pattern Selection Guide (Principle 4)

Choose the mock configuration pattern that matches your scenario count:

| Scenario characteristics | Pattern | Nesting depth |
|---|---|---|
| ≤3 scenarios, each with one or two different mock values | Nested `describe` → `beforeEach` override per layer | Up to 2 levels (root + child) |
| 4–8 scenarios, some share behavior | Root `beforeEach` sets baseline → nested describe overrides only diffs | Up to 3 levels |
| >8 scenarios with distinct mock configs or async setup that can't fit in beforeEach | Separate test blocks per scenario — each configures its own mocks inline | No nesting |
| Complex shared state across multiple tests (e.g., cache, tracked state) | Extract a helper function — call it from root `beforeEach` or nested `beforeEach` with scenario-specific args | N/A |

**DO NOT use nested describe blocks when:**
- Each test needs fundamentally different mock implementations (not just different return values) — inline config in separate test blocks is clearer than 3+ levels of nesting
- A child context would need to override more than 2 behaviors from its parent — the inheritance chain has become too fragile

### Root Baseline Rule (Principle 4)

A root-level `beforeEach` that sets *default* mock return values is acceptable and encouraged when:
- All tests in the describe block share one common behavior (e.g., "return empty list by default")
- Child contexts override only the *differences*, not the entire stub

A root baseline is NOT acceptable when:
- It configures mock data that varies between sibling tests (each test should configure its own)
- It forces child overrides to replace the entire stub rather than selectively override — use separate test blocks instead

### Helper Functions for Mock Setup (Principle 4)

Extracting mock config into helper functions is acceptable when:
- The helper takes explicit arguments that make each test's configuration visible at the call site
- The helper only *configures* mocks — it does not contain conditional logic that selects different behaviors based on argument truthiness/falsiness

Helper patterns are NOT acceptable when:
- The helper contains `if (arg)` branching that determines mock behavior — this is inline condition disguised as abstraction. Move the branching to separate tests or nested contexts instead.

### Mock Lifecycle: Setup, Teardown, and Cross-Test Contamination

All mocks require an explicit cleanup path. Neither pytest nor vitest cleans up test-created stubs automatically without specific configuration.

**Cross-test contamination prevention**: Every mock setup must include either an explicit teardown (yield/`afterEach` cleanup) or be scoped to a fixture with limited scope (`"function"` or `"class"`). No mocks should persist across unrelated tests. Mock call counts reset per test in both frameworks, but return values and stub configurations require explicit intervention.

See [TypeScript Conventions](./typescript-conventions.md#mock-lifecycle-and-teardown) for framework-specific mock lifecycle patterns including vitest's `vi.mock()` hoisting behavior, inline spy cleanup, async testing patterns, and extraction triggers with concrete thresholds.

## 5. One Assert Per Scenario, Group by Unit Under Test

Each `describe`/`context` block names the module or class being tested, not a scenario. Each inner test (or table row) covers one distinct input-output relationship. Do not name describe blocks after test scenarios ("when login succeeds") — name them after what is being tested ("auth service").

**Rationale:** Describes named after units form a stable navigation structure; describes named after scenarios drift as the code changes and force renaming tests that still cover the same unit.