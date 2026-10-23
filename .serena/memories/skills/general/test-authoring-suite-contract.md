---
id: skills/general/test-authoring-suite-contract
type: experiences
L0: "Give a test-authoring child the existing suite contract, fixtures and helper module — or hand it a purely mechanical edit; a child left to invent a parallel harness spends its budget on nondeterminism and returns neither code nor tests."
hotness: 0.8
ttl: 180d
version: 1
freshness: 2026-10-22
directory: skills/general
claim_ids: [claims/opencode/subtask_budget_per_turn, claims/opencode/validator_scope_limits]
provenance: RUG run 2026-10-22 modifying .opencode/plugins/tool-limit-reminder.ts; harness change in .agents/skills/test-design/SKILL.md v1.1.0 and .agents/skills/task-delegation/workflows/task-delegation-workflow.md v1.9
---
# Test-Authoring Delegation: Suite Contract or Mechanical Edit

## Idea
A delegated test task succeeds in one of two shapes: the prompt names the existing suite, its fixtures and helper module, plus the exact seam under test; or the child performs a mechanical edit against verbatim anchors. There is no third shape in which the child designs its own harness.

## Scope
Applies to every subtask that adds or changes tests for a module that already has a test file and a suite to extend, and to the orchestrator writing that prompt. Does not apply when a module has no suite: there a harness is a design decision and gets its own subtask before any test authoring.

## Rationale
A child that invents a parallel harness writes a second implementation of the behavior under test. Its RED and GREEN measure that implementation rather than the production path, so its observations are unverifiable even to itself. Fixture wiring, module contract and runner expectations are charged to the same call budget, so the child reaches the gate with neither production code nor trusted tests. Naming the suite removes the design decision and leaves only the behavior; a mechanical edit removes the decisions entirely.

## Evidence
RUG run on 2026-10-22 modifying .opencode/plugins/tool-limit-reminder.ts: the first implementer built a hand-rolled deterministic harness for a new test file instead of reusing the existing 774-line suite and its helper module. It exhausted its 24-call budget with 3 of 4 assertions RED, no implementation, and its own conclusion that "the evidence is contradictory". The work then split into a 3-line mechanical source edit that landed first try and a fresh test author reusing the suite, which returned a clean RED and GREEN in one pass. Verified anchors were present only in the prompts that succeeded.

Source: orchestrator observations of that run, item 1, 2 and 6. Harness change: .agents/skills/test-design/SKILL.md section "Extend the Existing Suite Before Building a Harness"; related mem:skills/general/subagent-budget-calibration, mem:skills/general/edit-heavy-task-splitting, mem:skills/general/delegation-granularity-and-verification.