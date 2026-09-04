---
id: events-about
type: about
hotness: 1.0
ttl: 90d
claim_ids: []
L0: "events: temporal captures with source→outcome"
L0_table:
  - id: events/extraction/batch-linkedin-2026-08
    L0: "2026-08 batch: 47/50 LinkedIn charts captured"
---
# Events

Event-centric temporal captures: what happened, when, source, outcome, and next step. Immutable logs, not living docs.

## Scope
- One event per extraction run or research sweep (timestamp, operator, source, selector, outcome, evidence).
- Events reference entities they touched (mem:entities/...) and claims they support (mem:claims/...).
- TTL governs retention; hotness decays via sigmoid*exp(-ln2/7*age) per consolidation-and-freshness.md.

## Boundaries (out of scope)
- Stable entity traits — mem:entities/about.
- Reusable distilled patterns — mem:experiences/about.
- Atomic claims — mem:claims/about.

## Related Domains
- mem:entities/about — entities touched by events.
- mem:cases/about — cases extracted from events.
- mem:cache/about — raw evidence backing events.
