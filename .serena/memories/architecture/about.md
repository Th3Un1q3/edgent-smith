# Architecture

Home for architecture decisions: records Architecture Decision Records (ADRs) with structured frontmatter, options analysis, and score-based selection.

## Scope

- Architecture/design choices with multiple viable options and trade-offs (one ADR per decision).
- ADRs live in the `architecture/adr/` subnamespace as `architecture/adr/ADR-NNN-<kebab-slug>`; every ADR follows the skeleton in `mem:architecture/adr-template` and the conventions in `mem:architecture/adr-rules`.

## Boundaries (out of scope)

- Routine implementation details, bug fixes, and research findings — those go to `mem:refactoring/`, `mem:troubleshooting/`, and `mem:researches/` respectively.
- Supporting evidence for a decision (mechanism internals, diagnosis, research) stays in its originating domain; ADRs link to it via `mem:` refs instead of duplicating it.

## Scoring rule

- Options are scored -2..+2 on maintainability, flexibility, implementation ease, and initial implementation cost.
- Best total wins; documented constraints (e.g., operator requirements) may override scores but MUST be documented in `## Considerations`; the Decision stays a self-contained statement.

## Structure

- `mem:architecture/adr-template` — the ADR skeleton (frontmatter; `## Decision` first; `## Considerations` with Context, Options considered, Scoring, Consequences at the bottom).
- `mem:architecture/adr-rules` — ADR conventions (ids, status lifecycle, scoring discipline).
- ADRs: `mem:architecture/adr/ADR-001-envelope-tag-detection` (accepted) and `mem:architecture/adr/ADR-002-memory-system-and-structure` (draft).