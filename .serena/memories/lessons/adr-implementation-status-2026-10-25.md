---
name: adr-implementation-status-2026-10-25
description: ADR implementation audit (20 rows) — non-implemented and partial set with evidence, plus the ratified next pick ADR-011.
scope: claims
status: active
confidence: high
timestamp: 2026-10-25
tags: [adr, audit, roadmap, adr-011, harness]
sources:
  - docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md
  - .opencode/reports/adr-005-implementation-audit.md
  - .opencode/plugins/helpers/workflow-subtask.ts
---

# ADR implementation status — 2026-10-25

Purpose: stop rescanning 20 ADRs. Read this before any ADR roadmap or
implementation task. Evidence lines are pointers, not quotes.

## Non-implemented / partial (12)

| ADR | Status | Evidence |
|---|---|---|
| ADR-001 | accepted / NOT-IMPLEMENTED | skills-loader deleted at 6dcc444 |
| ADR-004 | accepted / PARTIAL | workflow tool retired, so its workflow half is a stale-doc row at docs/workflow-tool.md |
| ADR-005 | accepted / PARTIAL | no validator agent per .opencode/reports/adr-005-implementation-audit.md:43,114 |
| ADR-006 | proposed / NOT-IMPLEMENTED | external devkit repo, no in-tree artifacts |
| ADR-007 | proposed / NOT-IMPLEMENTED | external devkit repo, no in-tree artifacts |
| ADR-008 | accepted / PARTIAL | goal tool scoped to rug/rug-workflow/rug-team-coach by design |
| ADR-009 | proposed / NOT-IMPLEMENTED | no in-tree artifacts reported |
| ADR-010 | proposed / N-A | superseded |
| ADR-011 | accepted / PARTIAL | keyed `instr-task-skills-<skill>` entry missing at .opencode/plugins/helpers/workflow-subtask.ts:951, per docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md:532,537 |
| ADR-012 | ~~proposed / PARTIAL~~ → accepted / IMPLEMENTED (2026-10-25) | code half in .opencode/plugins/workflow.ts:308/324/359; no `workflow` tool registered; see Status update |
| ADR-016 | proposed / NOT-IMPLEMENTED | .agents/skills/INDEX.md absent |
| ADR-017 | proposed / NOT-IMPLEMENTED | workflow-runner.ts 641 + workflow-script.ts 194 lines still present |

## Implemented (5)

ADR-002, ADR-003, ADR-013, ADR-015, ADR-019.

## Not applicable (2)

ADR-014, ADR-018.

## Ratified next pick: ADR-011

Why: accepted, exactly one located anchor, and every other accepted candidate is
either blocked externally (006/007) or designed-partial (008). Rejected first
pick was ADR-004: its target workflow tool was retired, so it is not enactable.
Measured gain: dedupe on resume plus retraction of injected skill text —
MARGINAL-BUT-CHEAP context hygiene, not a capability gap. Do not rank it as a
feature.

- **Anchor:** `.opencode/plugins/helpers/workflow-subtask.ts:951` still calls
  `injectSkills`, which prepends `<task_skills>` text with no removal path. The
  `instr-task-skills-<skill>` keys are already reserved at
  `.opencode/plugins/helpers/instructions-loader.ts:216,272`; plan reference
  docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md:532,537.
- **Design nuance:** the site's `WorkflowSdkClient` lacks entry APIs, so the
  write routes through `instruction-carrier` plus a `storage` handle.
- **Gate:** `cd .opencode && bun run --bun test tests/helpers/workflow-subtask.test.ts`
  (60 passing today). Broader pre-merge suite: `just opencode::test && just opencode::typecheck`.
- **Verification:** the targeted test above, then read back the keyed name in
  the helper diff.

## Process lessons from the audit run

See `mem:lessons/orchestration/file-priority-char-budget` and
`mem:lessons/orchestration/gate-scope-for-adr-memories`. Short form: wide
markdown rows overflow the ~4000-char result cap; slice ADR inventories into
<=8 rows with a fixed narrow column set, and open the tree a proposed work unit
depends on before picking it.

## Status update (2026-10-25, later run)

Supersedes the ADR-012 row above and the earlier ADR-011 gate/rationale.

### ADR-012 — accepted / IMPLEMENTED

`architecture/adr/ADR-012-standalone-subtask-trio` is now `status: accepted`
(4284 bytes) with an appended `## Status update (2026-10-25)` note. Code half
verified in tree: trio registered at `.opencode/plugins/workflow.ts:308/324/359`,
no `workflow` tool registered, retirement comment at `:190`.

Residues left, neither a misroute nor ADR-012 implementation:
- stale rows `docs/workflow-tool.md:5,17,342-343` — owned by ADR-004 as its
  stale-doc evidence;
- present-tense `workflow` prose plus `"workflow": "allow"` at
  `.opencode/agents/rug-workflow.md:8,18,423` and `.opencode/agents/rug.md:8`;
  the grants are inert because no such tool exists.

### ADR-011 — still the next pick

Rationale corrected above: MARGINAL-BUT-CHEAP context hygiene, not a capability
gap. It is the only accepted ADR with one located anchor.

### Lesson

An inert permission grant and present-tense prose are drift, not a live
misroute. Verify that a cited harm actually changes behaviour before ranking it.
