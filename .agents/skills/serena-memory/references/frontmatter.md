# Reference: Frontmatter — Canonical Spec

Define the YAML block that prefixes Serena memories and carries typed identity, disclosure, and lifecycle keys.

When to load: when you create, edit, validate, or search any Serena memory; before write_memory, gate checks, or L0/L1 recall.

Vocabulary: frontmatter — YAML block between --- delimiters at file top; L0 — 256c quoted summary in frontmatter; L0_table — sorted list of child L0s in an about memory; inferred — L0 derived from body when FM absent.

## Principles

- **Enforce --- delimiters:** open and close FM with --- on its own line.
- **Quote L0 and cap it:** store L0 as "quoted string" ≤256c.
- **Match id to memory_name:** set id exactly to write_memory memory_name.

## What Belongs — Keys by Family

### Typed (profile, preferences, entities, events, cases, trajectories, experiences, claims, cache)

| Key | Req | Notes |
|---|---|---|
| id | yes | Equals memory_name |
| type | yes | One of 9 typed scopes |
| L0 | yes | Quoted summary ≤256c |
| hotness | no | 0..1 per lifecycle formula |
| ttl | no | 30d/7d/90d/180d per TTL table |
| version | no | Increment on edit |
| freshness | no | YYYY-MM-DD |
| directory | no | Parent prefix |
| claim_ids | no | [claims/a, claims/b] |
| provenance | no | Source memory or docs |
| L0_table | about only | Aggregated child L0s |

### Other Families

- **ADR (architecture/adr/*):** id == memory_name, title, status (proposed/accepted/superseded), date (YYYY-MM-DD), optional scope.
- **About (profile/about, entities/about, ...):** type (parent scope), quoted L0 ≤256c, L0_table (sorted child L0s, cap 32), optional version and freshness.
- **Cache limited header (cache/* only, exempt):** tool, url, date required; optional source. No --- delimiters.

No other keys belong in frontmatter; the body holds remaining content.

## Which Memories Carry FM

Typed scopes (profile/\*, preferences/\*, entities/\*, events/\*, cases/\*, trajectories/\*, experiences/\*, claims/\*) require Typed FM + L0. architecture/adr/\* uses ADR FM. \*/about uses About FM + L0_table. overview/\* and index/\* are derived. cache/\* uses the limited header only. researches/\* synthesis, serena/\*, browser-automation/\*, private/\*, tooling/\* stay untyped until promoted; on promotion add Typed FM.

## FM vs Inferred

- **Bounded:** new typed memories carry FM with quoted L0 ≤256c and id == memory_name.
- **Inferred fallback:** legacy noFM memories derive L0 as the first non-empty body line slice(0,256); never exceed 256c.

## Inheritance

Each */about aggregates child L0s into L0_table sorted alphabetically, cap 32; the global index is the derived union across About tables, cap 32 per scope; `pending * 0.10 >= 1` triggers parent review.

## Search Method — Q1 / Q2 / Q3

Q1 searches About tables first, Q2 summarizes L0 per scope, Q3 fetches L1s by topic prefix; prefix scan is the fallback. Canonical budgets: L0 256c, L1 4000c, excerpt 700c. Snippets live in workflows/recall-memory.md; `snapshot`/`gatewayEmpty` helpers in [gateway-protocol.md](./gateway-protocol.md).

Hyphen prefix bug — `list_memories` prefix filter splits on `-`: `topic:"ci-failures"` returns `{}` (0) while `topic:"ci"` returns 1. Use `topic:"ci"` + client filter, or underscore ids `ci_failures`.

## Templates

Typed:

```yaml
id: entities/person/alice
type: entities
L0: "Alice — backend engineer, owns auth"
hotness: 0.72
ttl: 30d
version: 3
freshness: 2026-05-01
directory: entities/person
claim_ids: [claims/alice-role]
provenance: events/2026-05-01-interview
```

About:

```yaml
type: entities
L0: "Entities — people, systems, orgs in scope"
L0_table: ["entities/person/alice: Alice — backend", "entities/person/bob: Bob — infra"]
version: 2
freshness: 2026-05-01
```

## Formatting Rules

- Delimit FM with --- on its own line at top and bottom.
- Place top-level keys at column 0 with no leading space; indent nested structures 2 spaces.
- Quote L0 with double quotes and cap 256c; strip leading and trailing spaces from every FM line.
- Set id exactly equal to memory_name; balance --- delimiters.

## Exception Handling

- **Cache limited:** cache/* carries the limited header without ---; exempt from the Typed gate.
- **Researches synthesis:** researches/* exempt until promoted; then add Typed FM.
- **Legacy 491 noFM:** infer L0 as first body line slice(0,256) for search; migrate on edit.
- **Leading-space migration:** `body.replace(/^\s+(hotness|ttl|claim_ids|L0):/gm, "$1:")`.

## Acceptance Criteria

- Done when: FM uses one family above, L0 quoted ≤256c, id == memory_name, About L0_table sorted cap 32.

## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when research precedes FM.
