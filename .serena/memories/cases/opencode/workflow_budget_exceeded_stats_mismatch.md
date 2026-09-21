---
id: cases/opencode/workflow_budget_exceeded_stats_mismatch
type: cases
L0: "Known pre-existing limitation at HEAD: with concurrent subtasks a budget_exceeded envelope can drop an in-flight step, so stats.subtasks exceeds steps.length; independent of fork_from"
hotness: 0.8
ttl: 180d
version: 1
freshness: 2026-09-20
directory: cases/opencode
provenance: "Observed workflow run, documented docs/workflow-tool.md, 2026-09-20"
---
# budget_exceeded stats.subtasks can exceed steps.length
With concurrent subtasks (Promise.all fan-out), a `budget_exceeded` envelope can drop the step record of a subtask still in flight while the budget is overrun. Result: `stats.subtasks` is greater than `steps.length`.
- Known pre-existing limitation at HEAD, independent of `fork_from`.
- Documented in `docs/workflow-tool.md` Result envelope section ("Exception: a budget_exceeded envelope can show subtasks greater than the number of steps").
- Do not treat the mismatch as evidence of a fork_from bug.
Source: observed workflow run. See mem:cases/opencode/workflow_fork_from_envelope_truncation.