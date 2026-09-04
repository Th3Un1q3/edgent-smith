# Recipe: Consolidate Memories

Merge three stale, overlapping memories into one concise, typed summary.

When to load: when you have ≥3 memories with overlapping claims and hotness <0.3 and age >30d; when lifecycle signals consolidation.

## Consolidation Checklist — single checklist for 80% case

All thresholds in one place; deep dive refs linked.

- [ ] ≥3 overlapping memories sharing claims/domain — candidate filter
- [ ] Each candidate stale — age>30d && hot<0.3 or status superseded/disputed — see [references/claims.md](../references/claims.md)
- [ ] TTL checked per type — events 30d, cache 7d, claims 60d, profile 90d, cases/trajectories/experiences 180d — see [references/lifecycle.md](../references/lifecycle.md)
- [ ] Sample 32 deterministically — sort, slice(0,32) for overview
- [ ] 10% child-change ratio — pending*0.10≥1 triggers parent review
- [ ] 10% audit — audit 10% of merged memories after write
- [ ] Human gate mandatory — operator approves merged text before write_memory
- [ ] Dedup 0.9/0.6 and L0 256c applied — see [references/gating.md](../references/gating.md) and [references/disclosure.md](../references/disclosure.md)

> TTL vs staleness: TTL schedules review; staleness heuristic selects merge candidates. See [references/claims.md](../references/claims.md) table for which applies when.

## Prerequisites

- Activate serena sandbox; read [references/lifecycle.md](../references/lifecycle.md) and [references/claims.md](../references/claims.md).

## Steps

1. **Sample candidates** — list_memories filtered by domain, sort deterministically, slice 32 for overview. Done when: candidate list of 3+ overlapping memories selected.
2. **Verify staleness** — check each candidate: age >30d and hotness <0.3 or status superseded. Done when: all candidates stale per claims heuristics.
3. **Merge with human gate** — draft consolidated body with provenance covering 3 sources, claim_ids union, L0 256c summary; present to operator. Done when: operator approves merged text.

Gate: consolidation is human-triggered — never auto-merge without operator approval.

## Examples

Merge 3 event memories into one entities summary (copy-pasteable):

```javascript
// Inputs: events/2026-04-01-a, events/2026-04-02-b, events/2026-04-03-c
var sources = ["events/2026-04-01-a","events/2026-04-02-b","events/2026-04-03-c"];
var bodies = sources.map(function(s){ return read_memory({ memory_name: s }); });
// Draft merged memory
var frontmatter = "---\n" + "id: entities/person/alice#2026-05-01\n" + "type: entities\n" + "hotness: 0.72\n" + "claim_ids: [claims/alice-role, claims/alice-team]\n" + "provenance: "+sources.join(",")+"\n" + "L0: \"Alice — backend eng, team X; 3 events merged (256c)\"\n" + "---\n";
var merged = frontmatter + "# Alice — consolidated\n" + bodies.map(function(b){ return b.slice(0,500); }).join("\n---\n");
// Human gate check before write
var approved = true; // operator sets true
if(!approved) throw new Error("human gate not approved");
write_memory({ memory_name: "entities/person/alice", content: merged });
var echo = read_memory({ memory_name: "entities/person/alice" });
if(echo.indexOf("consolidated")<0) throw new Error("verify failed");
// Implements: 3→1 merge with provenance union
```

Sample 32 and staleness guard (numeric 32, 30d, 0.3):

```javascript
function sampleAndFilter(all, domain){
  var filtered = all.filter(function(m){ return m.indexOf(domain)===0; });
  filtered.sort();
  return filtered.slice(0, 32); // Implements: 32-sample
}
function shouldConsolidate(ageDays, hot){ return ageDays>30 && hot<0.3; } // Implements: >30d + hot<0.3
shouldConsolidate(45, 0.2) // true
```

## Acceptance Criteria

- Done when: 3 sources merged, provenance union present, L0 256c summary added, human approved, merged memory verified by read-back.

## Related Skills

- Call context-gathering via Skill tool on context-gathering/SKILL.md when merged claims need external verification.
