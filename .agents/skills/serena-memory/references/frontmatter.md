# Reference: Frontmatter — Canonical Spec

> Shaping exemption: canonical spec / snippet library — single source per Rule19/Rule24, split would duplicate truth. Flag threshold 250, not 120.

Define the YAML block that prefixes Serena memories and carries typed identity, disclosure, and lifecycle keys.

When to load: when you create, edit, validate, or search any Serena memory; before write_memory, gate checks, or L0/L1 recall.

Vocabulary: frontmatter — YAML block between --- delimiters at file top; L0 — 256c quoted summary in frontmatter; L0_table — sorted list of child L0s in an about memory; inferred — L0 derived from body when FM absent.

## Principles

- **Enforce --- delimiters:** open and close FM with --- on its own line.
- **Quote L0 and cap it:** store L0 as "quoted string" ≤256c.
- **Match id to memory_name:** set id exactly to write_memory memory_name.

## What Belongs — Keys by Family
### Typed (profile, preferences, entities, events, cases, trajectories, experiences, claims, cache)

| Key | Type | Required | Notes |
|---|---|---|---|
| id | string | yes | Equals memory_name |
| type | string | yes | One of 9 typed scopes |
| L0 | string | yes | Quoted summary ≤256c |
| hotness | float | no | 0..1 per lifecycle formula |
| ttl | string | no | 30d/7d/90d/180d per TTL table |
| version | int | no | Increment on edit |
| freshness | date | no | YYYY-MM-DD |
| directory | string | no | Parent prefix |
| claim_ids | array | no | [claims/a, claims/b] |
| provenance | string | no | Source memory or docs |
| L0_table | array | about only | Aggregated child L0s |
### ADR (architecture/adr/*)

| Key | Type | Required | Notes |
|---|---|---|---|
| id | string | yes | Equals memory_name |
| title | string | yes | Decision title |
| status | enum | yes | proposed/accepted/superseded |
| date | date | yes | YYYY-MM-DD |
| scope | string | no | Affected area |
### About (typed parent: profile/about, entities/about, etc.)

| Key | Type | Required | Notes |
|---|---|---|---|
| type | string | yes | Parent typed scope |
| L0 | string | yes | Quoted scope summary ≤256c |
| L0_table | array | yes | Sorted child L0s, cap 32 |
| version | int | no | Increment on aggregation |
| freshness | date | no | YYYY-MM-DD |
### Cache Limited Header (cache/* only, exempt)

| Key | Type | Required | Notes |
|---|---|---|---|
| tool | string | yes | Fetch tool |
| url | string | yes | Source URL |
| date | date | yes | Fetch date |
| source | string | no | Provenance hint |

> No other keys belong in frontmatter. Body holds remaining content.
### Limits Statement

| Aspect | Bounded (FM) | Inferred | Cap |
|---|---|---|---|
| Keys | Typed/ADR/About/Cache families | Reject unknown keys | — |
| L0 | Quoted string in FM | First body line slice(0,256) | 256c |
| L0_table | About FM array | Derived union of children | 32 sorted |
| Search | About tables + L0 index | Prefix scan fallback | 4000c L1, 700c excerpt |

### Skill shaping budgets (building-modular-skills gate)

| File | Budget | Check | Fix |
|---|---|---|---|
| `SKILL.md` | ≤160 lines (≤90 per Rule 1) | `wc -l SKILL.md` | Push detail to `references/` and `workflows/` |
| `references/*.md` | ≤120 lines (flag >250 for split) | `wc -l references/*.md` | Split reference or evict prose |
| `workflows/*.md` | ≤120 lines | `wc -l workflows/*.md` | Extract recipe or reference |
| Links and fences | 0 broken links, 0 fence errors | `validate_md_links.py` + `audit_fences.py` exits 0 | Fix links, wrap JSON fences |

> Run `just agent_utils::validate-memories` or `just agent_utils::validate-skill serena-memory` plus the shaping checklist before ship — one unchecked box means NOT complete.

## Which Memories Carry FM

| Pattern | FM Family | Gate | Notes |
|---|---|---|---|
| profile/*, preferences/*, entities/*, events/*, cases/*, trajectories/*, experiences/*, claims/* | Typed FM + L0 | 9 checks | Typed + Disclosed required |
| architecture/adr/* | ADR FM | ADR review | title/status/date required |
| */about | About FM + L0_table | Parent aggregation | Sorted cap 32 |
| overview/*, index/* | Derived | — | Generated union |
| cache/* | Limited header | Exempt | tool/url/date only |
| researches/* synthesis | No FM until promoted | Exempt | Add Typed FM on promotion |
| serena/*, browser-automation/*, private/*, tooling/* | No FM until promoted | Exempt | Untyped but not errors; promote to typed with FM |
| private verbatim | No FM | Exempt | Keep verbatim |

## FM vs Inferred

- **Bounded:** new typed memories carry FM with quoted L0 ≤256c and id == memory_name.
- **Inferred fallback:** legacy noFM memories derive L0 as first non-empty body line slice(0,256).
- **Cap:** never exceed 256c for any L0.

```javascript
function inferredL0(body){
  var line = body.split("\n").find(function(l){ return l.trim().length>0; }) || "";
  return line.slice(0,256);
}
inferredL0("# Alice\nBackend eng")
// Implements: inferred L0 fallback
```

## Inheritance

- **About aggregation:** each */about lists children L0s in L0_table sorted alphabetically, cap 32.
- **Global index:** derived union of all About L0_tables, sorted, cap 32 per scope.
- **Update rule:** pending * 0.10 >= 1 triggers parent About review.

```javascript
function aggregateAbout(c){ c.sort(); return c.slice(0,32); }
function needsParentReview(p){ return p * 0.10 >= 1; }
needsParentReview(10) // true — Implements: 32 cap + 0.10 ratio
```

## Search Method — Q1 / Q2 / Q3

Use About tables first; fall back to prefix scan.
### Q1 — Search by L0 via About tables

```javascript
function searchByL0(q){ var a=JSON.parse(list_memories({topic:"about"})).memories||[]; for(var i=0;i<a.length;i++){ var b=read_memory({memory_name:a[i]}); if(b.indexOf(q)>=0) return a[i]; } var all=JSON.parse(list_memories({})).memories||[]; return all.filter(function(m){return m.indexOf(q)>=0;}).slice(0,32); }
searchByL0("backend")
// Implements: Q1 index-first via about, fallback prefix scan
```
### Q2 — Summary L0 per Scope via About

```javascript
function scopeSummary(s){ var b=read_memory({memory_name:s+"/about"}); var fm=b.match(/^---\n([\s\S]*?)\n---/); return fm?fm[1].slice(0,4000):b.slice(0,4000); }
scopeSummary("entities")
// Implements: Q2 L0 summary per scope
```
### Q3 — Fetch All L1s via Topic Prefix

```javascript
function fetchL1s(topic){ var n=JSON.parse(list_memories({topic:topic})).memories||[]; n.sort(); return n.slice(0,32).map(function(m){ var f=read_memory({memory_name:m}); return {name:m,l1:f.slice(0,4000),excerpt:f.slice(0,700)}; }); }
fetchL1s("entities/person")
// Implements: Q3 topic prefix slice 4000c/700c
```

Hyphen prefix bug — `list_memories` prefix filter splits on `-`: `topic:"ci-failures"` returns `{}` (0) while `topic:"ci"` returns 1. Workaround — use `topic:"ci"` + client filter, or underscore id `ci_failures`. Normalize before filter: `topic.replace(/-/g,"_")`. Rename `researches/ci-failures*` → `researches/ci_failures*` when promoting; document hyphen as unsupported in prefix search.

```javascript
function safeTopic(t){ return t.replace(/-/g,"_"); } // use before list_memories
var ids = JSON.parse(list_memories({topic: safeTopic("ci-failures").split("_")[0]})).memories || [];
ids.filter(function(m){ return m.indexOf("ci-failures")>=0; });
// Implements: hyphen workaround — prefix ci + filter
```

Budgets: L0 256c, L1 4000c, 700c excerpt, 2048c cap.

## Templates
### Typed

```yaml
---
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
---
```
### ADR

```yaml
---
id: architecture/adr/001-use-serena
title: Use Serena for persistent memory
status: accepted
date: 2026-05-01
scope: memory
---
```
### About

```yaml
---
type: entities
L0: "Entities — people, systems, orgs in scope"
L0_table: ["entities/person/alice: Alice — backend", "entities/person/bob: Bob — infra"]
version: 2
freshness: 2026-05-01
---
```
### Cache Limited Header

```yaml
tool: fetch
url: https://example.com/docs
date: 2026-05-01
source: docs
```

## Formatting Rules

- Delimit FM with --- on its own line at top and bottom.
- Place top-level keys at column 0 with no leading space.
- Indent nested structures 2 spaces.
- Quote L0 with double quotes and cap 256c.
- Strip leading and trailing spaces from every FM line.
- Set id exactly equal to memory_name.
- Balance --- delimiters.

## Exception Handling

- **Cache limited:** cache/* carries limited header without ---; exempt from Typed gate.
- **Researches synthesis:** researches/* exempt until promoted; then add Typed FM.
- **Legacy 491 noFM:** infer L0 as first body line slice(0,256) for search; migrate on edit.
- **Leading-space migration:** `body.replace(/^\s+(hotness|ttl|claim_ids|L0):/gm, "$1:")` — Implements: migration regex

## Acceptance Criteria

- Done when: FM uses one family above, L0 quoted ≤256c, id == memory_name, About L0_table sorted cap 32.
## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when research precedes FM.
