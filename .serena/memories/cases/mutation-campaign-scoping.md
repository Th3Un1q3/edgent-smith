---
L0: "Three mutant-survival causes from one scoped Stryker campaign — testFiles narrower than the full covering set, dead code kept alive by tests, unasserted call arguments — each with the rule that fixes it."
name: mutation-campaign-scoping
description: Three mutant-survival causes from one scoped Stryker campaign and the rule that fixes each — partial testFiles scope, dead code kept alive by tests, unasserted call arguments.
scope: cases — three distinct causes with a fix applied, from one campaign; not preferences (no user choice) and not claims (the finding is procedural)
status: active
confidence: high
timestamp: 2026-10-28
type: cases
tags: [mutation-testing, stryker, coverage, dead-code, tests]
sources:
  - .serena/memories/architecture/adr/ADR-017-prune-plugin-suite-to-hook-core.md
---

# Mutation campaign: scope, dead code, unasserted arguments

## Idea

A mutation score is only as trustworthy as the test set the runner was told to use. Three
failure modes account for nearly every real survivor in a scoped campaign: the test set was
too narrow, the mutant sat on code that should not exist, or the test exercised the call
without checking its arguments.

## Scope

Three causes with their fixes, observed in one run over the OpenCode workflow plugin subtree
(ADR-017). Each is actionable without reading the campaign log.

## Rationale

1. **Scope `testFiles` to the full covering set.** Naming only the file's direct test drops
   every indirect test that also executes the file, so killed mutants count as survivors and
   the score misleads in both directions. Enumerate coverers (import graph or coverage run),
   not neighbours.
2. **Surviving mutants on dead code are grounds to delete the code, not to test it.** A test
   written to kill such a mutant pins behaviour nothing calls. `workflow-types.ts` ended with
   no behavioural mutants after `createEmptyStats`, `WorkflowStats`, `WorkflowEnvelope` and
   the dead milestone/notify path and `runId` were deleted.
3. **Unasserted call arguments are the most common real survivor.** Coverage marks the call
   site hit while its arguments stay unchecked, so literal mutations survive. Assert argument
   values, not call counts.
