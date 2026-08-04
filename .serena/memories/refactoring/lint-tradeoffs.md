# Lint Fixes Often Reveal Architectural Decisions

A lint error like `max-lines` (file too long) seems mechanical but often requires real architectural thinking:

## First Question

Is the file genuinely too complex? Check the test-to-source ratio. If >5x, the tests may be over-specified rather than the code over-long.

## When the Bloat Is Test-Side

Test-side bloat is usually fixed by consolidation, not splitting. For the full consolidation decision tree — `it.each` parameterization of overlapping tests, mutation-driven near-duplicates, and `max-lines` budget headroom — see mem:testing/test-consolidation.

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

Split only if the file tests genuinely unrelated behaviors (e.g., format vs. business logic vs. integration).

## Cross-References

- mem:testing/test-consolidation - canonical test consolidation decision tree and techniques
- mem:skills/testing - testing principles and conventions
