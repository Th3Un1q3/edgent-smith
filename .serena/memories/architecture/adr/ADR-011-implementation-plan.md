---
id: ADR-011-implementation-plan
title: ADR-011 implementation plan — instructions-loader migration to native instruction entries
status: accepted
date: 2026-10-21
scope: OpenCode RUG harness — implementation plan for ADR-011 instruction injection carrier
---

# ADR-011 implementation plan

ADR-011 (`mem:architecture/adr/ADR-011-native-session-scoped-instruction-entries`) is the accepted decision for instruction injection in the OpenCode RUG harness. Its implementation plan is finished and validated: `docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md` (958 lines). Read the plan instead of re-deriving the migration.

## Approach

The loader swaps its synthetic user-turn carrier for the native session-scoped instruction entry API: one keyed entry per matched instruction file, written through the existing instruction-entry client over the repo's constructed transport. An `INSTRUCTION_INJECTION` flag gates the new path; the synthetic path remains the fallback until the rollout gates close, and the plugin-managed idempotency tokens are retired afterwards.

## Scope boundary

Instruction selection, the targeted-tool gate, and the steering payload stay unchanged. Only the carrier changes.

## Shape

Six phases, each with an owning test suite and a real justfile verification gate, plus a flagged rollout, a rollback procedure, and a requirement-by-requirement verification checklist.

## Traceability

All 103 ADR-011 requirements are mapped with a disposition. Every departure from the ADR's literal text is recorded as an auditable decision row naming the ADR amendment it needs.

## Open items

The maintainer settles the decision rows in the plan's decision table. The plan's open-questions section carries ADR-011's own questions forward, each with an owning phase.