---
id: claims/opencode/subtask_budget_per_turn
type: claims
L0: "A child's ~24-call budget (steps 30 x 0.8) is per turn: idle children reset on task_id resume, mid-turn children carry their count"
hotness: 0.7
ttl: 60d
version: 1
freshness: 2026-10-22
directory: claims/opencode
confidence: 0.9
status: active
provenance: RUG orchestration retrospective, verified 2026-10-22
---
# subtask_budget_per_turn
fact: A child's budget is about 24 tool calls, derived as steps (30) x 0.8, and it is counted per turn. An idle child's counter is cleared, so resuming with task_id opens a fresh 24-call window; a child still mid-turn resumes with its consumed count intact.
scope: Orchestrators sizing and resuming subtask children.
evidence: 24 is emitted as a stop reminder, not a hard block; children are exempt from blocking, so a count above 24 is overrun evidence rather than an error.
rule: Size a turn to ~24 calls and use task_id resume to buy a new window.
Source: observed orchestration run, 2026-10-22; harness step/budget constants (30 x 0.8).