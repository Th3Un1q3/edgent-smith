---
id: cases/orchestration/timeout-habit-and-proxy-judging
type: cases
L0: "An orchestrator omits timeout_minutes unless the task outruns the default and never retypes a child's findings or rules on them: both habits came from the operative agent card, while the skill forbade them in one narrow line"
hotness: 0.7
ttl: 180d
version: 1
freshness: 2026-10-26
directory: cases/orchestration
provenance: "Observed 2026-10-26 in one orchestration session: a timeout_minutes value on ~40 dispatches and hand-built FACT/FINDINGS blocks; contradiction confirmed by grep of .opencode/agents/rug*.md and .agents/skills/task-delegation"
---
# A forbidden habit survives when only the skill forbids it

RULE. Two orchestrator habits share one cause: the operative agent card licensed them while the prohibition lived in a skill line scoped to a narrower object.

- Timeouts: omit `timeout_minutes`. Set it only for a task expected to outrun the 15-minute default, never to shorten or to size a dispatch. An expired child is tailed with `subtask_tail` and resumed on the same `task_id` with a fresh budget; a larger guessed value is not the remedy.
- Carrying: pass a child's report as its `outputText` verbatim, as a path or id pointer, or by resuming that `task_id`. A `FACT`/`FINDINGS`/`SUMMARY` block composed from a child's report is a retype.
- Judging: the orchestrator renders no verdict, ranking, comparison, or `PASS`/`FAIL` of its own. Dispatch a fresh child to rule — `Fresh judge` for one artifact, one subtask for a comparison — and forward its line-1 verdict with its evidence.

EVIDENCE. `.agents/skills/task-delegation/workflows/task-delegation-workflow.md:58` said "Leave `timeout_minutes` unset unless this task is expected to outrun the default", but `.opencode/agents/rug-workflow.md:61` said "Size per-call `timeout_minutes` deliberately", `:93` required an explicit value for any child that might exceed 15, and the resume template at `rug.md:138` carried `timeout_minutes: args.timeout_minutes` — so the card, which is what the orchestrator reads, overrode the skill. `rug.md:81` forbade retyping only "a verdict", leaving findings uncovered, and nothing forbade the orchestrator ruling in its own `Criteria:` line.

FIX. `rug.md:36,81-82,138,395`, `rug-workflow.md:61,93`, `task-delegation-workflow.md:58`, `SKILL.md:43` (task-delegation 1.5.26) state omission plus the resume fallback, and `Carry, never retype` / `Judge, never rule` with the permitted alternatives named.

CHECK. `grep -rn "timeout_minutes" .opencode/agents .agents/skills/task-delegation` — every hit is omission, a default statement, or a resume; no hit instructs a per-dispatch value. A session that composed a context block or wrote its own PASS has broken the rule.

RELATED. `cases/orchestration/prompt-rule-contradicted-by-own-examples` (the examples also carried the habit); `cases/orchestration/child-evidence-before-verdict`; `cases/opencode/workflow_producer_unverified_tree`.
