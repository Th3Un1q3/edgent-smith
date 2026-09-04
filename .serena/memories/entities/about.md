---
id: entities-about
type: about
hotness: 1.0
ttl: 90d
claim_ids: []
L0: "entities: typed external org/person profiles"
L0_table:
  - id: entities/companies/german-it-sector
    L0: "German IT sector: 50 companies, fintech leads 59%"
---
# Entities

Typed external entity profiles (companies, people, teams) distinct from research syntheses. Each entity aggregates stable attributes and links to event histories.

## Scope
- Company/people/team profiles with stable attributes (sector, size, tech stack, LinkedIn state).
- One leaf per entity at entities/<subdomain>/<entity-slug>; aggregates summarize groups.
- Research syntheses stay in mem:researches/about; raw fetches in mem:cache/about.

## Boundaries (out of scope)
- Temporal hiring events — mem:events/about.
- Reusable extraction cases — mem:cases/about.
- Operator identity — mem:profile/about.

## Related Domains
- mem:researches/german-it-companies/overview — source corpus for german entities.
- mem:events/extraction/batch-linkedin-2026-08 — events that populated entities.
- mem:claims/about — atomic claims about entities.
