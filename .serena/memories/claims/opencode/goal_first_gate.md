---
id: claims/opencode/goal_first_gate
type: claims
L0: "Orchestrator turns must call goal({action:'set'}) before any execute call; execute is blocked until the goal is declared"
hotness: 0.7
ttl: 60d
version: 1
freshness: 2026-10-22
directory: claims/opencode
confidence: 0.9
status: active
provenance: RUG orchestration retrospective, verified 2026-10-22
---
# goal_first_gate
fact: Goal-first enforcement blocks execute until goal({action:'set'}) has been called in the current turn.
scope: Any agent session with goal-first enforcement active (orchestrator turns in this harness).
evidence: Enforcement is a blocking precondition, not advisory; an orchestrator that opens with execute stalls.
rule: Declare the turn goal first, then issue tool calls; re-declare when the goal changes.
Source: observed blocking behavior in orchestration run, 2026-10-22; harness goal-first gate.