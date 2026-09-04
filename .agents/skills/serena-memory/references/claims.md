# Reference: Claims — Extraction, Staleness, Confidence

Store atomic facts with evidence in claims/ before evolving.

When to load: when you extract atomic facts from events or memories; when you check staleness or confidence; before workflows/evolve-memory.md.

Vocabulary: claim — atomic fact with evidence, confidence, and status in claims/; staleness — age + superseded signal that triggers review.

## Principles

- **Extract claims atomically:** one fact per claims/ memory with evidence provenance.

## Claim Schema

| Field | Type | Notes |
|---|---|---|
| fact | string | Single atomic statement |
| evidence | string | Source memory (mem:events/... or docs) |
| confidence | float | 0..1, ≥0.6 for active use |
| status | enum | active / superseded / disputed |
| hotness | float | 0..1 per lifecycle formula |

Frontmatter on typed memory links claims via array syntax — See [frontmatter.md § What Belongs](./frontmatter.md):

```yaml
---
claim_ids: [claims/alice-role, claims/alice-team]
provenance: events/2026-05-01-interview
---
```

Array syntax: bracketed comma-separated list; no trailing space; 2-space indent for nested.

## Confidence Thresholds

| Level | Range | Action |
|---|---|---|
| High | ≥0.8 | Use directly, evolve eligible |
| Medium | 0.6–0.8 | Use with citation, monitor |
| Low | <0.6 | Mark UNVERIFIED, do not evolve |

- **Verify confidence ≥0.6** before evolving or merging.

## Staleness Heuristics vs TTL — which applies when

TTL (see [references/lifecycle.md](./lifecycle.md)) sets review deadline per type; staleness heuristic triggers human review for claims when both age and activity are low.

| Type | TTL | Staleness heuristic | When to apply |
|---|---|---|---|
| events | 30d | age>30d && hot<0.3 → review | TTL expiry for events; staleness for overlapping claims |
| cache/fetch | 7d | — | TTL only |
| claims | 60d | age>30d && hot<0.3 → review | Staleness for consolidation; TTL 60d for re-verify |
| profile/preferences | 90d | — | TTL only |
| cases/trajectories/experiences | 180d | age>30d && hot<0.3 → review | TTL 180d for compress; staleness for merge candidates |

- Use TTL to schedule review; use staleness (age>30d && hot<0.3) to select merge candidates. Status superseded/disputed always stale regardless of age.

## Staleness Heuristics

- **Age >30d and hotness <0.3** → review for consolidation (human trigger).
- **Superseded provenance** → mark status: superseded, keep for audit, always stale.
- **Disputed with conflicting evidence** → mark disputed, require human gate, always stale.

## Examples

Write a claim with evidence (copy-pasteable):

```javascript
function writeClaim(id, fact, evidence, confidence){
  var body = "---\n" + "id: "+id+"\n" + "confidence: "+confidence+"\n" + "status: active\n" + "---\n" + "fact: \""+fact+"\"\n" + "evidence: "+evidence+"\n";
  write_memory({ memory_name: id, content: body });
  // verify
  var echo = read_memory({ memory_name: id });
  if(echo.indexOf(fact.slice(0,10))<0) throw new Error("claim verify failed");
}
writeClaim("claims/alice-role","Alice is backend engineer","events/2026-05-01-interview",0.92)
// Implements: atomic claim + evidence + confidence
```

Staleness check (30d and hot <0.3):

```javascript
function isStale(ageDays, hot, status){
  if(status==="superseded"||status==="disputed") return true;
  return ageDays > 30 && hot < 0.3;
}
isStale(45, 0.2, "active") // true — Implements: >30d + hot<0.3 stale
isStale(10, 0.8, "active") // false
```

Confidence guard before evolve:

```javascript
function canEvolve(conf){
  if(conf < 0.6) throw new Error("confidence <0.6 — mark UNVERIFIED");
  return true;
}
canEvolve(0.92) // pass — Implements: ≥0.6 threshold
```

## Acceptance Criteria

- Done when: claim has fact+evidence+confidence, confidence ≥0.6 for evolution, staleness checked, status set.

## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when evidence comes from external research.
