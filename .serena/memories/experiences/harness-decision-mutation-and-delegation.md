---
id: experiences/harness-decision-mutation-and-delegation
type: experiences
L0: "Harness decision — mutation-testing skill owns the mutation lifecycle; task-delegation batches mechanical edits into 2–4 slices with isolated behaviour changes."
status: active
confidence: high
timestamp: 2026-10-28
scope: experiences — adopted rules, not one case
tags: [harness, mutation-testing, task-delegation]
sources:
  - mem:cases/mutation-campaign-scoping
provenance: operator directive 2026-10-28; 13-slice ADR run retrospective
---

# Harness decision: mutation lifecycle and delegation slicing

## Idea
`mutation-testing` owns the mutation lifecycle: dead-code sweep first; one source→test-set map; full covering `testFiles`; per-run report copies; target 80, break-72 floor; triage real vs equivalent; stop at adequacy; TypeScript only. `task-delegation` batches mechanical edits into 2–4 slices, isolates behaviour changes, finalizes decision-record counts once with one read-back.

## Scope
Skill rules only; survivors: mem:cases/mutation-campaign-scoping.

## Rationale
A 13-slice ADR run plus wave-wise mutation re-runs cost more orchestration and recovery calls than code.
