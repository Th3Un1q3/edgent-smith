# Reference: Lifecycle — TTL, Versioning, Hotness, Consolidation

Track memory freshness, version, and consolidation triggers.

When to load: when you set TTL, compute hotness, version memories, or decide consolidation.

Vocabulary: hotness — decayed activity score in 0..1; TTL — time-to-live before review; lifecycle — create→interact→compress→archive→store progression.

## Consolidation Checklist — all thresholds in one place

Check every box before merging; see [recipes/consolidate.md](../recipes/consolidate.md) for steps and [references/claims.md](./claims.md) for staleness.

- [ ] TTL per type — events 30d, cache/fetch 7d, claims 60d, profile/preferences 90d, cases/trajectories/experiences 180d
- [ ] Staleness heuristic — age>30d && hot<0.3, or status superseded/disputed — see [references/claims.md](./claims.md)
- [ ] Sample 32 deterministically — sort then slice(0,32)
- [ ] 10% child-change ratio — pending*0.10>=1 triggers parent review
- [ ] 10% audit — audit 10% of merged memories for accuracy
- [ ] Human gate mandatory — never auto-merge

## TTL Table

| Scope | TTL | Action on expiry |
|---|---|---|
| events | 30d | Review, promote or archive |
| cache/fetch | 7d | Refresh or delete |
| claims | 60d | Re-verify evidence |
| profile/preferences | 90d | Refresh on change |
| cases/trajectories/experiences | 180d | Consolidate when stale |

> TTL sets the review deadline; staleness heuristic (age>30d && hot<0.3) selects merge candidates — see [references/claims.md](./claims.md) for which applies when.

## Hotness Formula

```
hotness = sigmoid(log1p(active_count)) * exp(-ln2/7 * age_days)
sigmoid(x) = 1/(1+exp(-x))
half-life = 7 days
```

- **Verify hotness** before reranking; boost = 1+0.05*log(1+count) where count = mem: refs.

## Versioning and Metadata

See [frontmatter.md § Templates](./frontmatter.md) for canonical FM examples with id, type, L0, hotness, ttl, version, freshness, directory, claim_ids, provenance.

- Increment version on each edit; update freshness date.

## Consolidation Triggers (Human, Not Automated)

- **10% child-change ratio:** pending_child_changes * 0.10 ≥1 → review parent.
- **Sample 32:** sort children deterministically, slice 32 for overview.
- **10% audit:** audit 10% of merged memories for accuracy.

## Examples

Hotness computation (half-life 7 days, copy-pasteable):

```javascript
function hotness(activeCount, ageDays){
  var s = 1/(1+Math.exp(-Math.log1p(activeCount)));
  var decay = Math.exp(-Math.log(2)/7 * ageDays);
  return s * decay;
}
hotness(5, 3) // ~0.64 — Implements: hotness formula
```

TTL expiry check (30d for events):

```javascript
function isExpired(createdDate, ttlDays){
  var age = (Date.now() - new Date(createdDate))/86400000;
  return age > ttlDays;
}
isExpired("2026-04-01", 30) // true — Implements: 30d TTL
```

Sampling 32 children:

```javascript
function sampleOverview(children, limit){
  limit=limit||32; children.sort();
  return children.slice(0,limit);
}
sampleOverview(["events/b","events/a","events/c"], 32) // Implements: 32-sample
```

Parent review trigger (0.10 ratio):

```javascript
function needsParentReview(pending){
  return pending * 0.10 >= 1;
}
needsParentReview(10) // true — 10*0.10=1 — Implements: 10% ratio
```

## Acceptance Criteria

- Done when: TTL set per table, hotness computed with 7-day half-life, version and freshness updated, consolidation triggers checked.

## Related Skills

- Call harness-management via Skill tool on harness-management/SKILL.md when lifecycle reveals repeated stale patterns.
