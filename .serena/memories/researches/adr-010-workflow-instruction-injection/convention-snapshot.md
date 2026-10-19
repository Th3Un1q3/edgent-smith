---
title: ADR convention snapshot — house rules and template headings
description: "Verbatim snapshot of the house ADR convention from mem:architecture/adr-rules, adr-template, and about: required frontmatter, status vocabulary, numbering, and section order, with registry gaps noted."
tags: [adr, conventions, template, architecture, house-style]
---

# ADR Convention Snapshot

Sources: mem:architecture/adr-rules, mem:architecture/adr-template, mem:architecture/about.

## Digest

- Required frontmatter fields: id, title, status, date, scope.
- Status vocabulary: draft, proposed, accepted, rejected, superseded. Lifecycle: draft -> proposed -> accepted or rejected; a later decision that changes an earlier one marks the earlier one superseded with a superseded-by: ADR-NNN note. Never rewrite history.
- Naming and numbering: sequential integer ids (ADR-001, ADR-002, ...); the memory slug follows the id, ADR-NNN-<kebab-slug>; one memory per ADR under architecture/adr/.
- Section order: ## Decision first; ## Considerations at the bottom with ### Context, ### Options considered, ### Scoring, ### Consequences.
- Index/registry: neither adr-rules nor adr-template requires an index entry. The domain memory mem:architecture/about keeps an ADR list in its Structure section; that list ends at ADR-008, so ADR-009 and ADR-010 have no registry entry.

## Template headings in order (verbatim)

# ADR-NNN: <title>
## Decision
## Considerations
### Context
### Options considered
#### Option A: <name>
#### Option B: <name>
### Scoring
### Consequences

---

## Source 1: mem:architecture/adr-rules (verbatim)

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

---

## Source 2: mem:architecture/adr-template (verbatim)

---
id: ADR-NNN
title: <short title>
status: <draft | proposed | accepted | rejected | superseded>
date: YYYY-MM-DD
scope: <system area this decision covers>
---

# ADR-NNN: <title>

## Decision

The Decision is a clear, self-contained statement of WHAT was decided — one or two declarative sentences that read standalone.

How to form a good decision message:
- Form: "<what is decided> <chosen approach>" plus the essential implementation detail — e.g., "One-time envelope implemented as an XML tag and parsed with a regex."
- Test: a reader who reads ONLY this section must understand the outcome. If you need the scoring or options to make sense of it, it is not self-contained.
- Do: state the concrete choice (technology, pattern, structure); use declarative voice ("is", "uses", "implemented as"); name the key mechanics.
- Don't: recap scores ("wins with +7"), list rejected options, hedge ("probably", "might"), or use relative language ("better", "close").

The analysis (options, pros/cons, scoring, and any constraint overrides) lives in Considerations below. Best total score wins; note any constraints that override scores in Considerations.

## Considerations

### Context

Why this decision is needed: the problem, constraints, and relevant facts.

### Options considered

#### Option A: <name>
Pros:
- ...
Cons:
- ...

#### Option B: <name>
...

### Scoring

Criteria (each scored -2 to +2):
- Maintainability — ease of understanding and evolving over time
- Flexibility — adaptability to future requirements
- Implementation ease — straightforwardness with the current stack
- Initial implementation cost — effort to build (higher score = cheaper)

|Criteria | Opt A | Opt B | Opt C |
| Maintiainability| -1 | -2 | 0 |
| Flexibility | 2 | 0 | -1 |
| Implementation ease | 0 | 0 | 0 |
| Initial implementation cost | -2 | 1 | 0 |
| Total   | ? |  ? | ? |

### Consequences

What changes as a result of this decision.


---

## Source 3: mem:architecture/about (verbatim, registry evidence)

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
- ADRs: `mem:architecture/adr/ADR-001-envelope-tag-detection` (accepted), `mem:architecture/adr/ADR-002-memory-system-and-structure` (accepted), `mem:architecture/adr/ADR-003-tag-delimited-structured-output` (accepted), `mem:architecture/adr/ADR-004-workflow-timeout-units-minutes` (accepted), `mem:architecture/adr/ADR-005-multi-agent-orchestration-strategy` (accepted), `mem:architecture/adr/ADR-006-portable-agent-devkit` (proposed), `mem:architecture/adr/ADR-007-testing-and-cicd-contract-for-agent-devkit` (proposed), and `mem:architecture/adr/ADR-008-goal-stack-continuation` (proposed).
