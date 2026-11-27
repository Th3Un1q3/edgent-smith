# Mock Configuration and Gate Principles

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

## Principle 7: Run Quality Gates After Every Discrete Edit, Not Just at the End
Post-hoc validation of large refactoring batches is insufficient. When modifying test files — especially during consolidation or shared helper extraction — run quality gates (test suite + linting) after each discrete edit, not only after all changes are applied. A single-pass approach to multi-file refactoring makes it impossible to isolate which change introduced a failure, turning debugging into a binary search across dozens of edits. Validate continuously: small scope → gate → confirm → next scope → repeat.

Formatting belongs to this loop, and it spans every language the change touches, not only the bulk of it. Run the formatter for each touched file type — including a test file in another language than the rest of the diff — before the final gate. One Python test file inside a TypeScript refactor turned the last gate red on formatting alone and cost an extra full gate run.

## Principle 8: Prove Gate Scope With a Resolution Probe

A gate, linter, or test that enumerates files by glob has a scope only if something resolves it. For each immediate subdirectory of the tree the gate claims to cover, pin one probe that asserts the glob resolves to at least one file. Pin per subdirectory, not per glob: a single catch-all assertion passes while an entire subtree is missing. A comment never states a glob's coverage; the probe is the statement of scope.

A plugin complexity gate whose globs omitted one subdirectory left 26 files — 14 functions above the ceiling — uncovered while a comment claimed the whole plugin tree. A per-subdirectory probe would have reported zero matches at the first threshold ratchet, instead of after two ratchets of refactoring had built on the gap.
