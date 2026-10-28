---
name: mutation-testing
description: >-
  Run mutation testing campaigns with Stryker, decide when a mutation score is
  adequate, and triage surviving mutants into real test gaps and equivalents.
  Use when the user mentions mutation testing, mutants, Stryker, surviving
  mutants, mutation score, a score below threshold, coverage adequacy, or asks
  whether tests catch behaviour changes rather than merely executing lines.
  Also use when coverage is high but tests assert nothing, or when a refactor
  needs evidence that the existing suite would catch a regression.
license: MIT
compatibility: Requires Stryker + Vitest on this repository's .opencode TypeScript tree
metadata:
  version: "1.0.0"
  delta: |
    1.0.0 — initial skill: dead-code sweep first, one source-to-test-set map, an
    adequacy target at the configured high threshold, one consolidated run per
    file with the report copied aside, and survivor triage against observable
    behaviour.
---

# Mutation Testing

Coverage records that a line executed. Mutation testing records whether a test
fails when that line's behaviour changes. A mutation score below the target means
the suite executes code it does not check.

## When to use

- Measure assertion strength for a file whose tests already pass and whose
  coverage exists.
- Decide whether a module's tests are adequate before a refactor, a release, or
  a new contributing suite.
- Interpret a Stryker report: surviving mutants, a score under the gate, or
  no-coverage paths.

## When not to use

- **Not a substitute for unit tests.** A file with no tests kills no mutant.
  Write the covering tests first, then mutate.
- **Not a coverage tool.** Coverage answers whether a line ran; run it before
  mutating, because a no-coverage mutant is a missing test rather than a weak
  assertion.
- **Not a style or documentation check.** Mutants measure behaviour only.
- **Not for Python.** This repository has no Python mutation tool. Say so
  instead of installing or naming one.

## Task Routing Table

| I want to... | File |
|---|---|
| Run a campaign end to end | [workflows/run-campaign.md](./workflows/run-campaign.md) |
| Judge adequacy, classify a survivor, or record results | [references/adequacy.md](./references/adequacy.md) |

## Before mutating

1. **Sweep dead code first.** Delete unreachable branches, unused exports, and
   never-called helpers before the first run. Dead code produces surviving
   mutants that no legitimate test can kill, and writing a test to cover it
   keeps code alive that nothing needs; a survivor on dead code means delete the
   code.
2. **Build one source-to-test-set map.** For every file under `mutate`, list
   each suite that exercises it, and include a newly written covering suite in
   the same pass. `.opencode/stryker.config.mjs` scopes `testFiles` to
   `plugins/tests/**/*.test.ts`, so a suite outside that glob leaves the file's
   mutants untested and produces a false low score. Fix the scope before you
   read the score as a test gap.
3. **Read the thresholds from the config**, not from memory:
   `.opencode/stryker.config.mjs` sets `high: 80`, `low: 60`, `break: 72`.

## Adequacy contract

Decide these three values before the first run; the campaign is done when the
last one holds.

| Line | Value | Meaning |
|---|---|---|
| Target | 80 or the configured `high` | A file is adequate at or above it; aim here |
| Gate floor | 72 or the configured `break` | Below it the run exits nonzero; it is a floor, not a target |
| No-coverage | 0 on live paths | Every live path is exercised; one means a missing test |

Never lower `high`, `low`, or `break` to make a campaign pass, and never replace
a pinned number; fix the test that leaves a mutant alive. Decision detail:
[references/adequacy.md](./references/adequacy.md).

## Campaign method

Run the ordered procedure in [workflows/run-campaign.md](./workflows/run-campaign.md):
sweep dead code, map suites, set the target, write gap tests, then one
consolidated run per file. Two rules hold across that procedure:

- **One consolidated run per file after the gap tests.** A run per added test
  multiplies wall time and reports the same survivors.
- **Copy each report aside.** Every run overwrites the same JSON report path, so
  copy it under a per-file name before the next run; the campaign record reads
  the copies, not the live path.

## Triage

Classify every survivor as real or equivalent, and record which:

- **Real** — the mutant changes observable output or a call argument and no test
  fails. Add the missing assertion.
- **Equivalent** — no test can distinguish the mutant from the original. Record
  it with the reason and move on.
- Assert observable behaviour and call arguments. Never assert internals:
  private fields, call counts on implementation-only paths, or the shape of an
  intermediate object. A test that pins internals kills mutants and blocks
  refactors, which inverts the purpose.

## Scope and tooling

- TypeScript with Stryker and the Vitest runner, driven by
  `just .opencode/mutation --mutate <path>`; scope each run to one file with
  `--mutate`.
- Python has no mutation tooling in this repository. Report that absence rather
  than substituting a coverage number, and never present a coverage percentage
  as a mutation score.

## Recording results

Write one row per mutated file into the campaign record the workflow names, with
the score, the target comparison, each survivor's classification, the
no-coverage paths, and the action taken for each. Fields and stop conditions:
[references/adequacy.md](./references/adequacy.md).
