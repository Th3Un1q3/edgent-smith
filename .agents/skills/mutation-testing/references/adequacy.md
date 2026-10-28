# Adequacy Decisions

Load this file when a run finishes and you must decide whether a file is
adequate, whether a survivor is a test gap, or what the campaign record holds.
Thresholds come from `.opencode/stryker.config.mjs`: `high: 80`, `low: 60`,
`break: 72`.

## Decision table

Apply the first row that matches.

| Condition | Reading | Action |
|---|---|---|
| Score ≥ target (80) and no-coverage 0 on live paths | Adequate | Stop the campaign for this file |
| Score 80 or above with no-coverage above 0 | Contradiction | Fix the source-to-test-set map; a no-coverage path means a suite is outside `testFiles` |
| Score ≥ 72 and < 80 | Gate floor only | Continue: the gate passes, the target does not; kill real survivors |
| Score < 72 | Gate fails | Triage first, then write gap tests; never lower `break` |
| Survivors on unreachable code | Dead code | Delete the code, not write a test |
| Score drops while every test passes | Scope fault | The suite set changed, not the assertions; recompute the map |

The target is 80. The break value 72 keeps a failing run failing; a score of 72
to 79 is a passing gate with an inadequate suite, and treating 72 as the goal
records the floor as the standard.

## What counts as a real gap

A survivor is a real gap when a legitimate test could observe the difference.

- **Boundary mutant** (`>` for `>=`, `<` for `<=`) survives: no test sits on the
  boundary value.
- **Return-value mutant** survives: the assertion is weaker than the contract,
  for example a truthiness check where the exact value matters.
- **Call-argument mutant** survives in a collaborator call: no test asserts the
  arguments passed, only that the call happened.
- **Error-path mutant** survives: the throwing branch has no test.

A real gap is closed with an assertion on observable behaviour, a return value,
a thrown error, or the arguments handed to a collaborator. It is never closed by
asserting a private field, an internal counter, or the order of internal calls.

## Equivalent mutants

An equivalent produces the same observable behaviour as the original for every
input the function accepts. No test can kill it.

| Pattern | Why it is equivalent |
|---|---|
| `text.slice(0, limit)` mutated to `text.slice(0, limit + 1)` where `limit ≥ text.length` | Both return the whole string; the extra index is past the end |
| Redundant `typeof value === 'string'` mutated to `true` on an already-narrowed parameter | The type guard is unreachable false; behaviour is unchanged |
| A default parameter value changed, when a later guard rejects the default | The guard returns before the default can appear in output |
| An `if (false)`-equivalent invariant check on a value the caller guarantees | The branch never runs for any accepted input |
| A write to a field no consumer reads | No observable output changes |

Handle an equivalent by recording it with the reason and leaving the code alone.
Do not add a test that pins the equivalent construct, and do not reshape
production code only to make the mutant killable. When the equivalent construct
must stay and the score needs it excluded, a line-level
`// Stryker disable next-line <mutator>` comment carries the equivalence reason
on the same line; it changes no threshold.

## When to stop

- Stop a file when its score is at or above the target and its live paths have
  zero no-coverage entries.
- Stop the campaign when every mutated file meets that condition, or when the
  remaining survivors are recorded equivalents.
- Stop before the target when the remaining real gaps sit behind a suite the
  campaign cannot add, and record the blocker; do not report the gate as passed.
- Do not keep running for headroom above the target. Each run costs wall time,
  and a score of 88 buys nothing a score of 82 does not.
- A second run on an unchanged file reuses the incremental cache; if the score
  moved, the tests or the `mutate` scope changed, so re-read the map first.

## What to record

One row per mutated file, written where the campaign workflow says.

| Field | Value |
|---|---|
| File | Path as it appears under `mutate` |
| Score | Percentage for this file, with the target it was compared against |
| Survivors (real) | Mutant location, the assertion added, the test name |
| Survivors (equivalent) | Mutant location and the equivalence reason from the table above |
| No-coverage | Paths with no covering test, plus the action: test added or code deleted |
| Report copy | Path to the copied JSON report for this run |
| Outcome | `adequate`, `gate-only`, or `blocked`, with the blocker named |
