# ADR Rules

Conventions for writing and maintaining Architecture Decision Records (domain: `mem:architecture/about`; skeleton: `mem:architecture/adr-template`).

- Write an ADR when a non-trivial architecture/design decision has ≥2 viable options with trade-offs (one ADR per decision).
- Ids are sequential integers (ADR-001, ADR-002, ...); the memory slug follows the id (`ADR-001-<kebab-slug>`).
- ADRs live under the `architecture/adr/` subnamespace, one memory per ADR, named `ADR-NNN-<kebab-slug>`.
- Frontmatter fields are REQUIRED: id, title, status, date, scope.
- Section order: `## Decision` comes FIRST (right after the title, for readability); the analysis — `### Context`, `### Options considered`, `### Scoring`, `### Consequences` — follows at the bottom under `## Considerations`.
- Status lifecycle: `draft` → `proposed` → `accepted` or `rejected`; a later decision that changes an earlier one makes the earlier `superseded` (add a `superseded-by: ADR-NNN` note to its frontmatter) — NEVER rewrite history.
- Score discipline: every option is scored on ALL criteria (-2..+2); totals must be explicit in the scoring table; the highest total wins; constraints (e.g., operator requirements) may override scores but MUST be documented in `## Considerations` (not in the Decision, which stays self-contained).
- Options considered: at least 2, each with pros AND cons.
- Keep ADRs lightweight (≈1 memory, concise bullets); link evidence (research memories, files) via `mem:` refs.
- Reference `mem:architecture/adr-template` and `mem:architecture/adr-rules` when writing a new ADR.
- Decision style: the `## Decision` must be a clear, self-containing statement of what was decided (readable standalone). Form it as "<what is decided> <chosen approach>" plus the essential implementation detail, in declarative voice — e.g., "One-time envelope implemented as an XML tag and parsed with a regex." Do NOT recap scores, list rejected options, or hedge ("probably", "better", "close"); the rationale (options, pros/cons, scoring) belongs in `## Considerations`.