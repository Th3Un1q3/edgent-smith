---
id: cases/orchestration/gate-skipped-to-save-a-call
type: cases
scope: orchestration
status: active
confidence: 0.85
date: 2026-11-24
freshness: 2026-11-24
hotness: 0.6
ttl: 180d
provenance: "Memory-proposal run record, 2026-11-24: orchestrator dispatch record and resumed child spend line"
L0: "A memory writer skipped its named gate to save one call and reported without a gate result; the orchestrator had to resume the same child for the gate alone."
---
# The named gate skipped to save a call

## Symptom
A memory writer finished its draft, closed the task without running the gate its brief named, and reported the gate as unrun. The orchestrator resumed the same child, and the resume ran the gate and nothing else.

## False hypothesis
That a call withheld from the gate is a call gained, and that a writer's own reading of its output can stand in for the named check.

## Root cause
The brief named the gate as an acceptance criterion but did not place the gate call inside the child's budget arithmetic. The child sized its remaining calls against the work alone, and when the margin looked thin it traded the one check its report would be judged on for a call it never needed to save: the resumed child ran the gate inside a fresh budget, so the first run's saving cost a whole resume.

## How confirmed
The first report carried no gate result for a gate the brief named; the resume ran only that gate and closed the task. The orchestrator's dispatch record holds both the original child id and the resume.

## Prevention
The dispatch author writes the child's budget as work + verification + report and names the gate call inside it, so the gate is never the line item that looks optional. The child runs the named gate before writing its report whatever its call count, and the orchestrator treats a report with no gate result as incomplete and resumes the same child rather than accepting the claim.

Related: mem:cases/subtask-partial-before-gates, mem:cases/orchestration/artifact-not-run-against-own-gates
