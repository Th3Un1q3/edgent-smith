---
id: harness/delegation/convention-change-propagation
type: cases
L0: "Changing a documented convention is a multi-memory contract: rule, template, domain about, index in one pass; existing artifacts are grandfathered"
hotness: 0.5
ttl: 180d
freshness: 2026-10-25
directory: harness/delegation
provenance: architecture/adr-rules rework; read-back of mem:architecture/adr-rules and mem:architecture/about on 2026-10-25
---
# Convention change propagation

- **A convention change is one contract across several memories.** Before calling it done, update in the same pass: the rule memory, its template, the domain overview (`*/about`) that restates the convention, and the index. A validator reads each copy independently, and whichever copy still carries the old doctrine is the one a reader believes.
- **Observed failure.** After the ADR rules moved `## Decision` to last with per-decision criteria, `mem:architecture/about` still said "`## Decision` first" with the fixed four criteria; only the overview lagged, yet it read as authoritative. The order now agrees in `mem:architecture/adr-rules` and `mem:architecture/about`.
- **Grandfather existing artifacts.** A reworked convention applies forward and to still-proposed artifacts only; accepted history is never rewritten to fit the new shape (`mem:architecture/adr-rules`).
- Source: operator report of the ADR rework, plus read-back of the three memories on 2026-10-25.
