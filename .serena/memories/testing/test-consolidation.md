# Test File Consolidation Strategy

When consolidating split test files back into a single file:

## Pre-Consolidation Analysis (DO THIS FIRST)

1. **Count duplication across files** — measure shared boilerplate (imports, mocks, `beforeEach`, helper functions). This is pure savings.
2. **Identify overlapping tests** — grep for identical `it("description"...)` blocks and `describe` blocks that test the same behavior from different angles. These can be merged with `it.each`.
3. **Separate mutation-driven tests** — tests that exist solely to kill equivalent mutants (e.g., testing both `undefined` and `{}` for the same guard). These can be parameterized into table-driven tests.
4. **Calculate the consolidation budget** — ESLint `max-lines` with `skipBlankLines: true, skipComments: true` gives significant headroom. Measure logic lines, not raw lines.

## Consolidation Techniques (USE THESE)

- **Table-driven `it.each`** for scenarios that differ only by input state (tool names, token suffixes, boundary values).
- **Inline small helpers** (<15 lines) rather than separate helper files. Saves a file and cross-file import complexity.
- **Single preamble** — one set of imports, one `vi.mock` block, one `beforeEach`, with nested `describe` overrides where behavior differs. Recovers the boilerplate each split file duplicated.
- **Merge mutation-only near-duplicates** into parameterized tests that vary only the mock state.

## What NOT to Do

- Do NOT split a test file solely for a lint rule without first evaluating the consolidation approach.
- Do NOT create separate helper files for tiny utility functions used in one test file.
- Do NOT preserve overlapping tests "just in case" — if two tests verify the same behavior from different angles, consolidate them.

## Cross-References

- mem:skills/testing - general testing methodology
- mem:refactoring/meta-lessons - process insights from earlier refactoring
