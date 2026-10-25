---
id: lessons/evaluations/contract-only-failure
type: experiences
L0: "Contract-only failure: rug-swe treated the task contract as a deliverable; now contract is a plan and must be followed by execution in the same turn."
hotness: 0.67
ttl: 180d
version: 1
freshness: 2026-10-25
directory: lessons/evaluations
scope: experiences — recurring procedural lesson from an eval/orchestration failure, not an atomic claim
provenance: operator report of a rug-swe contract-only turn, 2026-10-25
---
# Contract-only failure

## Failure
A child agent emitted the task contract and ended its turn without executing. The deliverable was a short command task, so the contract was the only output and nothing checkable existed.

## Root cause
The rug-swe harness required a contract before any other tool call, and no rule stated that the contract is not the deliverable. On a short command task the contract reads as the whole job, so the child stopped after writing it.

## Fix
The contract is an internal plan. Emit it and execute in the same turn. A turn whose only output is the contract is incomplete and must never be reported as done.

Resident Core: a contract alone is not a checkable artifact. Completion is claimed only against execution output or a changed file.

## Orchestrator rule
When a child returns contract-only, resume that child once with its `task_id` plus the instruction "execute now". Do not relaunch the same deliverable from scratch and do not re-plan it: the plan already exists.

## Evidence
Source: operator report of the contract-only turn (2026-10-25). Recurrence check: scan child transcripts for a turn whose last output is the contract block with no tool result.

## Refs
mem:lessons/orchestration/subtasks-emit-findings — same failure family: a child's output must be checkable, never a plan.
