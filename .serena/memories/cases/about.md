---
id: cases-about
type: about
hotness: 1.0
ttl: 90d
claim_ids: []
L0: "cases: reusable extraction cases distilled"
L0_table:
  - id: cases/browser-automation/linkedin-growth-chart
    L0: "LinkedIn growth chart: aria-label regex extraction"
---
# Cases

Reusable distilled cases extracted from events/browser-automation: one problem, solution, and verification per case. Cases compose into trajectories (3 cases → 1 trajectory) per agent-evolution.md.

## Scope
- Cases at cases/<subdomain>/<case-slug>: selector, quirk, failure mode, verified fix, and provenance mem: refs.
- Distilled from mem:events/about and mem:browser-automation/about recipes.
- Atomic enough to reuse across sites; trajectories aggregate 3+ cases.

## Boundaries (out of scope)
- Raw event logs — mem:events/about.
- Cross-case patterns — mem:experiences/about.
- Atomic claims — mem:claims/about.

## Related Domains
- mem:browser-automation/about — source recipes for case extraction.
- mem:experiences/about — patterns distilled from cases.
- mem:events/extraction/batch-linkedin-2026-08 — event that yielded cases.
