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
- An extracted shared factory's return shape must exactly match every consumer's property access chain. Audit all consumers before extracting — a mismatched `.session.get` vs `.client.session.get` nesting breaks runtime tests silently until the full suite runs.
- Extracted helpers must have minimal, direct APIs. If an extracted helper requires passing mock factories, complex configuration objects, or nested dependency graphs as arguments, it is too coupled and should stay inline. A good helper takes data (e.g., `makeHelper(metas)`) — not infrastructure (e.g., `makeHelper({ indexerFactory: ..., maxChars: ... })`).

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

Mock configuration, assertion grouping, and quality-gate principles continue in [mock-and-gate-principles.md](./mock-and-gate-principles.md).
