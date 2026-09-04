---
id: claims-about
type: about
hotness: 1.0
ttl: 90d
claim_ids: []
L0: "claims: atomic sourced claims with evidence"
L0_table:
  - id: claims/agentic-memory/dual-layer-claim
    L0: "dual-layer: Serena source, vector reference cache"
  - id: claims/cache/verbatim-rule-claim
    L0: "cache entries stay verbatim; syntheses link via mem:"
  - id: claims/linkedin/growth-chart-selector-claim
    L0: "LinkedIn growth chart needs aria-label regex"
---
# Claims

Atomic, sourced, verifiable claims with confidence and evidence links. Each claim traces to mem:cache/* or mem:researches/* source; YAML frontmatter carries claim_ids for graph traversal (frontmatter-and-claims.md, okf-sidecar-and-uri.md).

## Scope
- One claim per memory at claims/<subdomain>/<claim-slug>: statement, source, confidence, evidence lines, and claim_ids.
- Claims are the verdict layer for retrieval reranking (scoring-and-rerank.md: 0.6*BM25+0.3*vector+0.1*hotness, boost 1+0.05*log(1+count)).
- Aggregates/syntheses reference claims via claim_ids in frontmatter.

## Boundaries (out of scope)
- Raw cache evidence — mem:cache/about.
- Synthesized research — mem:researches/about.
- Entity traits — mem:entities/about.

## Related Domains
- mem:cache/about — raw source for claims.
- mem:researches/agentic-patterns-memory-patterns — source for dual-layer claim.
- mem:experiences/browser-automation/bot-defense-patterns — consumes claims.
