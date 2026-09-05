# Reference: Typed Memory Scopes

Assign every memory to one of 9 typed scopes before gating.

When to load: when you choose a domain prefix for write_memory; before every store via workflows/store-memory.md.

Vocabulary: type — one of 9 typed scopes that determines placement; domain — the typed prefix before the slash.

## Principles

- **Type every memory before gating:** verify domain prefix matches registered type before write_memory.

## Frontmatter Keys

See [frontmatter.md § What Belongs — Typed](./frontmatter.md) for canonical Typed FM keys (id, type, L0, hotness, ttl, version, freshness, directory, claim_ids, provenance, L0_table). Do not duplicate that table here.

## 3 Context Types → Serena

| OpenViking Type | Serena Domain Pattern | Purpose |
|---|---|---|
| Resource | cache/* | External fetched content, verbatim (transient cache; researches/* synthesis via context-gathering, exempt until promoted) |
| Memory | profile/, preferences/, entities/, events/, claims/ | Persistent knowledge about user/world |
| Skill | cases/, trajectories/, experiences/ | Procedural evolution, reusable patterns |

Experiences aggregate 3 trajectories → hint describes experience content, not its topic prefix

## 9 Memory Types — Placement Rules

| # | Type | Serena Path | Example Name | Notes |
|---|---|---|---|---|
| 1 | profile | profile/ | profile/user/background | Identity and soul are sub-paths: profile/identity/voice, profile/soul/values |
| 2 | preferences | preferences/ | preferences/editor/theme | User choices, settings; profile subpaths only identity/soul — preferences/*flat vs profile/preferences/* nested (top-level preferences:0 empty, use profile/preferences) |
| 3 | entities | entities/ | entities/person/alice | People, systems, orgs |
| 4 | events | events/ | events/2026-05-01-meeting-notes | Time-stamped observations |
| 5 | cases | cases/ | cases/bugfix/auth-timeout | Single failure + fix |
| 6 | trajectories | trajectories/ | trajectories/auth-timeout | Pattern across 3 cases |
| 7 | experiences | experiences/ | experiences/auth-patterns | Pattern across 3 trajectories |
| 8 | claims | claims/ | claims/alice-role | Atomic fact + evidence |
| 9 | cache | cache/ | cache/fetch/github-pr-42 | Resource verbatim, TTL short |

### Exempt patterns — untyped but not errors

| Pattern | Gate | Notes |
|---|---|---|
| `serena/*`, `cache/*`, `researches/*` (synthesis), `private/*`, `browser-automation/*` | exempt from Typed + Disclosed | Untyped until promoted; not a gate error |

Identity/soul rule: store under profile/ — profile/identity/*for voice/role, profile/soul/* for values/beliefs; never create top-level identity/ or soul/ domains.

About inheritance: each typed scope aggregates children into */about with About FM — See [frontmatter.md § Inheritance](./frontmatter.md) for L0_table sorted cap 32 and 0.10 update rule.

## Topic Filter Semantics — prefix matching

`list_memories({topic:"prefix"})` does prefix matching on memory name, not exact equality.

```javascript
// prefix filter — copy-pasteable
var raw = list_memories({ topic: "researches/german-it-companies" });
var memories = JSON.parse(raw).memories || [];
// returns researches/german-it-companies/* and researches/german-it-companies itself
var raw2 = list_memories({ topic: "researches" });
var allResearch = JSON.parse(raw2).memories || []; // all researches/* — Implements: prefix semantics
// BAD: topic:"automa" → 0 (prefix != substring); GOOD: topic:"browser-automation"
```

Use `list_memories({})` with manual filter when you need exact match.

## Synthesis Ambiguity — researches/* vs Resource

`researches/*` synthesis is a Resource-synthesis typed as `researches/` prefix but may lack `type:` frontmatter until promoted to `entities/` or `claims/`. Treat it as Resource for disclosure budgets and exempt it from the Typed gate check until promoted.

- Gate exemption: `researches/*` synthesis bypasses Typed check; add `type:` on promotion.
- Frontmatter may be absent; add it when you promote to entities/claims.

```javascript
function isResearchSynthesis(name, frontmatter){
  if(name.indexOf("researches/")===0 && !frontmatter) return "Resource-synthesis — gate Typed exempt";
  return "typed";
}
isResearchSynthesis("researches/german-it-companies", null) // exempt — Implements: synthesis ambiguity
```

## Examples

Typed placement check (9 types):

```javascript
function typedScope(name){
  var scopes=["profile/","preferences/","entities/","events/","cases/","trajectories/","experiences/","claims/","cache/"];
  for(var i=0;i<scopes.length;i++) if(name.indexOf(scopes[i])===0) return scopes[i];
  throw new Error("untyped memory: "+name);
}
typedScope("entities/person/alice") // entities/
// Implements: 9-type placement rule
```

Profile sub-path example:

```javascript
write_memory({ memory_name: "profile/identity/voice", content: "---\ntype: profile\n---\nVoice: concise, active." });
write_memory({ memory_name: "profile/soul/values", content: "---\ntype: profile\n---\nValues: accuracy, brevity." });
// Implements: identity/soul under profile/
```

## Acceptance Criteria

- Done when: memory name carries typed prefix from the 9-type table and type field matches prefix.

## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when classifying external content as cache vs claims.
