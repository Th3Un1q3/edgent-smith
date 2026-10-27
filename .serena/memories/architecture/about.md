# Architecture

Home for architecture decisions: records Architecture Decision Records (ADRs) with structured frontmatter, options analysis, and score-based selection.

## Scope

- Architecture/design choices with multiple viable options and trade-offs (one ADR per decision).
- ADRs live in the `architecture/adr/` subnamespace as `architecture/adr/ADR-NNN-<kebab-slug>`; every ADR follows the skeleton in `mem:architecture/adr-template` and the conventions in `mem:architecture/adr-rules`.

## Boundaries (out of scope)

- Routine implementation details, bug fixes, and research findings — those go to `mem:refactoring/`, `mem:troubleshooting/`, and `mem:researches/` respectively.
- Supporting evidence for a decision (mechanism internals, diagnosis, research) stays in its originating domain; ADRs link to it via `mem:` refs instead of duplicating it.

## Scoring rule

- Criteria are derived per decision: 3 to 5 chosen for THIS decision's dominant risk, each with a one-line justification of why it belongs to this decision's kind, plus a record of criteria a reader might expect but that were rejected as non-discriminating. There is no mandatory universal set; reuse Maintainability/Flexibility/Implementation ease/Initial implementation cost only when it discriminates for this decision.
- Every eligible option is scored -2..+2 on every criterion with explicit totals, unweighted unless the ADR states and justifies weights; `## Non-negotiable requirements` are hard pass/fail filters, so an option failing one is ineligible — recorded, named against the requirement it violates, and excluded from the totals.
- The highest total among eligible options wins; documented constraints (e.g., operator requirements) may override scores but MUST be documented in the ADR, not in the self-contained Decision.

## Structure

- `mem:architecture/adr-template` — the ADR skeleton (frontmatter; population order: optional `## Context`, then `## Criteria` → `## Options considered` → `## Non-negotiable requirements` → `## Scoring` → `## Decision` last as the output of those stages, then `## Consequences`).
- `mem:architecture/adr-rules` — ADR conventions (ids, status lifecycle, decision-derived criteria, non-negotiable filters, scoring discipline, grandfathering of existing ADRs written in the old order).
- ADRs: `mem:architecture/adr/ADR-001-envelope-tag-detection` (accepted), `mem:architecture/adr/ADR-002-memory-system-and-structure` (accepted), `mem:architecture/adr/ADR-003-tag-delimited-structured-output` (accepted), `mem:architecture/adr/ADR-004-workflow-timeout-units-minutes` (accepted), `mem:architecture/adr/ADR-005-multi-agent-orchestration-strategy` (accepted), `mem:architecture/adr/ADR-006-portable-agent-devkit` (proposed), `mem:architecture/adr/ADR-007-testing-and-cicd-contract-for-agent-devkit` (proposed), `mem:architecture/adr/ADR-008-goal-stack-continuation` (proposed), `mem:architecture/adr/ADR-009-skill-usage-heuristics` (proposed), `mem:architecture/adr/ADR-010-workflow-tool-instruction-injection` (proposed), `mem:architecture/adr/ADR-011-native-session-scoped-instruction-entries` (accepted), and `mem:architecture/adr/ADR-016-skill-directory-grouping` (proposed) — flat `.agents/skills/<name>` directories stay canonical; grouping ships as a generated `INDEX.md` with `group` and `tag` columns. Later records: `mem:architecture/adr/ADR-019-skill-eval-conductor-pipeline` (accepted), `mem:architecture/adr/ADR-020-serving-opencode-web-locally-with-tunneling` (proposed).
