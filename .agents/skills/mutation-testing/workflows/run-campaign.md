# Campaign Workflow

Run one campaign over a set of changed TypeScript files, from scope to a recorded
per-file result. Thresholds and scope live in [SKILL.md](../SKILL.md); survivor
classification and stop rules live in [adequacy.md](../references/adequacy.md).

## 1. Scope the campaign

List the behavioural files the change touches, then mutate them one at a time.

- In: `plugins/*.ts` and `plugins/helpers/**/*.ts` files whose diff changes
  behaviour.
- Out: `*.d.ts` shims, type-only files with no executable code (the config's only
  type exclusion is `types/instructions.ts`), `__mocks__/**`, `plugins/tests/**`, and
  files whose diff is comments or formatting only — `git diff -w --stat` empty for
  that path means nothing to mutate.

## 2. Sweep dead code before the first run

Delete unreachable branches, unused exports, and never-called helpers before
mutating. Dead code yields survivors no legitimate test can kill, and a test
written to cover it keeps code alive that nothing needs.

A survivor reported on code that no caller reaches is a deletion task, not a gap:
remove the code and re-run.

## 3. Build one source-to-test-set map

For every file under `mutate`, list the suites that exercise it — by import in
the test file and by suite name — and write that list down once.

- Include every new covering suite in the same pass, before the baseline run.
- `.opencode/stryker.config.mjs` scopes `testFiles` to
  `plugins/tests/**/*.test.ts`; a suite outside that glob does not run, so its
  file's mutants stay untested and the score reads false-low.
- A test added later joins the map at that moment; a stale map is the first
  suspect when a score drops while every test passes.

## 4. Read the config, then fix the report path

Read `.opencode/stryker.config.mjs` rather than assuming its values: `mutate`
covers `plugins/*.ts` and `plugins/helpers/**/*.ts` minus shims, types, mocks and
tests; `testFiles` is `plugins/tests/**/*.test.ts`; thresholds are `high: 80`,
`low: 60`, `break: 72`.

Every run writes `.opencode/reports/mutation/mutation.json` and `mutation.html` —
the same paths each time, overwritten by the next run. Copy each report aside
under a per-file name (`.opencode/reports/mutation/<file>.mutation.json`) before
starting the next run, or give each run its own `--reportDirectory`; with one
shared path, serialize the runs and copy between them.

## 5. Baseline each file with its full covering set

Run from the repository root; the recipe is the `opencode` module's, also
reachable as `just mutation` from inside `.opencode/`.

```bash
just .opencode/mutation \
  --mutate plugins/tool-limit-reminder.ts \
  --testFiles "plugins/tests/tool-limit-reminder.test.ts,plugins/tests/budget.test.ts" \
  --reporters clear-text,json
```

- Pass the whole covering set, comma-separated, in one run. A subset executes
  fewer tests and reports survivors that live tests would have killed.
- Read that file's row in the score table, never the run-wide score: the header
  figure covers every file the run actually mutated.
- `reports/stryker-incremental.json` is reused on warm runs. When it lists
  modules that were deleted or renamed, rename it to
  `stryker-incremental.json.stale` and re-run; a cache naming dead modules
  attributes their mutants to the current run.

## 6. Triage every survivor

Classify each survivor before touching a test, and record which class it took.

- **Real gap** — the mutant changes observable output or a call argument and no
  test fails. Close it.
- **Equivalent** — no accepted input distinguishes it from the original. Record
  the reason and leave the code alone; do not add a test that pins it.

Assert observable behaviour: return values, thrown errors, emitted output, and
the arguments handed to collaborators. Never assert private fields, internal
counters, or the order of internal calls — such a test kills mutants and blocks
refactors, inverting the purpose of the campaign.

## 7. Close the major gaps, then re-run affected files only

Fix real gaps in descending survivor count per file; an error path with no test
outranks a boundary case that already has one. Write the assertion, confirm the
suite is green once, then re-run mutation for that file only.

One consolidated run per file after the gap tests. A run per added test
multiplies wall time and reports the same survivors; a new suite joins the
`--testFiles` list at the same time it joins the map.

## 8. Stop at the adequacy contract

A file is done at score ≥ 80 with zero no-coverage entries on live paths; the
campaign is done when every mutated file reaches that, or when the remaining
survivors are recorded equivalents. `break: 72` is the floor, never the target,
and no threshold moves to make a run pass.

Record once per file: score with the target it was compared against, real
survivors with the assertion added, equivalents with the reason, no-coverage paths
with the action taken, the copied report path, and the outcome (`adequate`,
`gate-only`, `blocked`). Fields: [adequacy.md](../references/adequacy.md).

Do not re-run for headroom above 80; a re-run buys nothing a pass does not.

## 9. Failure modes

- **`--mutate` does not always narrow.** Config merging can leave the `mutate`
  array in force. If the score table lists files you did not name, the run is
  wide: let it finish and read your file's row, or give each file its own report
  directory; never read the run-wide figure as that file's score.
- **Exit code 1 is the threshold, not a crash.** `break: 72` fails the run
  without any error. Triage the report first; a genuine crash exits nonzero with
  no JSON report or with a stack trace, and that is the case to debug.
- **Report artifacts stay out of commits.** `.opencode/reports/` is gitignored;
  `mutation.json` and `mutation.html` run to megabytes. Never `git add -f` them.
