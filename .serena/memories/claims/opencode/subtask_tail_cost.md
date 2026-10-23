---
id: claims/opencode/subtask_tail_cost
type: claims
L0: "subtask_tail costs the orchestrator one call and consumes none of the child's budget"
hotness: 0.7
ttl: 60d
version: 1
freshness: 2026-10-22
directory: claims/opencode
confidence: 0.9
status: active
provenance: RUG orchestration retrospective, verified 2026-10-22
---
# subtask_tail_cost
fact: Reading a child's output with subtask_tail charges one call to the orchestrator and zero to the child.
scope: Orchestrators watching child progress or collecting results without spending child budget.
evidence: Observed call accounting during orchestration; the child counter is unaffected by tail reads.
rule: Tail after dispatch to inspect progress instead of re-prompting the child for status.
Source: observed orchestration run, 2026-10-22; harness tool accounting.