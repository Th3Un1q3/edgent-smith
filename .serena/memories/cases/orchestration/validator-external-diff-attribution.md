---
id: cases/orchestration/validator-external-diff-attribution
type: cases
L0: "A validator in a shared tree needs the run's expected files and TODO set; an out-of-set staged file or TODO is another actor's work, reported external, never a failed criterion."
hotness: 0.7
ttl: 365d
version: 1
freshness: 2026-10-27
directory: orchestration
status: active
provenance: RUG orchestration run, 2026-10-27; shared working tree with a concurrent actor
---

# A validator must attribute diffs before failing a criterion

idea: give the validator the run's expected file and marker set, and label out-of-set diffs external.

scope: cases — one observed false failure in a shared working tree, with its fix.

rationale: a validator judging the tree cannot tell the run's writes from a concurrent actor's, so without the expected set it charges the run for damage the run never did.

Failure: another actor staged 11 files and added an unrelated TODO in `.opencode/plugins/helpers/workflow-subtask.ts` mid-run; validators counted both against the run until they were handed the expected file and TODO sets.

Source: observed in the orchestration run, 2026-10-27.

Rule: the prompt names the run's expected files and expected markers; an out-of-set staged file, modified file, or TODO is reported as external and leaves the criterion verdict unchanged.
