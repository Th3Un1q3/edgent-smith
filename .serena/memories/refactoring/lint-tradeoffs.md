# Lint Fixes Often Reveal Architectural Decisions

A lint error like `max-lines` (file too long) seems mechanical but often requires real architectural thinking:

## Decision Tree for max-line Violations

1. **Is the file genuinely too complex?** Check the test-to-source ratio. If >5x, the tests may be over-specified.
2. **Can I consolidate via table-driven tests?** `it.each` with object tables compresses 5-10 similar test bodies into one.
3. **Is the bloat from mutation-mandated near-duplicates?** These tests are hard to eliminate. Parameterize them.
4. **Is the bloat from duplicated mock setup?** Move to a single `beforeEach` with nested `describe` overrides.
5. **Would a split be cleaner?** Only split if the file tests genuinely unrelated behaviors (e.g., format vs. business logic vs. integration). Never split solely for the line count.

## The Cost of Splitting

Splitting a test file has hidden costs:
- ~30-40 lines of duplicated boilerplate per additional file
- Loss of shared `beforeEach` context
- Harder to navigate (developer must find the right split file)
- Mutation tests still run all files, so no speed benefit

## The Cost of Consolidating

Consolidating has costs too:
- Larger single file is harder to scroll through
- May hit `max-lines` again if new tests are added
- `describe` block nesting can become deep (max 3 in this project)

## Cross-References

- mem:testing/consolidation - specific consolidation strategies
- mem:skills/testing - testing principles and conventions
