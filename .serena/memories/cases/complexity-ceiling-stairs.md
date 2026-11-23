---
id: cases/complexity-ceiling-stairs
type: cases
L0: "Behaviour-coupled refactor fanned out as parallel batches: per-batch verification missed a regression a per-wave status pass caught."
hotness: 0.62
ttl: 180d
version: 2
freshness: 2026-11-23
directory: cases
provenance: operator account of the campaign on this tree, cross-checked against the tree and final gate
---

# Complexity-ceiling stairs

## Symptom
A high-risk refactor campaign across ~50 files produced a mid-flight behaviour regression. Several concurrent agents each reported their own view of the tree, and one batch's view of what remained was wrong.

## False hypothesis
That batches touching disjoint files cannot interfere. They interfere through shared behaviour: a regression in a shared module surfaced in another batch's test run, and sibling edits made typecheck authoritative only after the wave ended.

## Root cause
The dispatch author fanned behaviour-coupled refactoring out like content edits: verification was per-batch, and no authoritative read-only status pass existed between waves.

## How confirmed
The orchestrator added one read-only status pass after each wave: lint findings, suite totals, typecheck, pins. It reconciled every batch report, found the regression and the stale "already fixed" claims, and narrowed the cause to one helper in `.opencode/plugins/helpers/instructions/instruction-payload.ts`.

## Prevention
For a stair above ~100 sites, the dispatch author runs waves of 3-5 disjoint batches, attaches the `mutation-testing` skill to high-risk dispatchers and restore paths, and ends every wave with one orchestrator-owned read-only status. A batch report stays a claim until that status confirms it.

## Simplification first
The simplification ladder (ponytail) cut more complexity per edit than extraction did. The final full gate reported mutation score 80.31 against a break threshold of 72, and 1190 tests across 85 files; the score held above the threshold through the stair.

Source: operator account, tree check of the named helper, final gate output. `mem:cases/orchestration/child-evidence-before-verdict` states that evidence precedes verdict.