---
id: profile-preferences-interaction-style
type: preferences
hotness: 1.0
ttl: 90d
claim_ids: []
L0: "operator prefers concise, verified, cache-first outputs"
---
# Interaction Style Preferences

9-check gate: pass — standalone (describes style bias), verified (inferred from 494-memory corpus conventions), reusable (guides future synthesis), non-duplicative (no prior preferences memory), discoverable (via mem:profile/about), right-size (2 paras), privacy (no PII), event-centric N/A, dedup: new domain.

Operator style in this workspace favors concise, evidence-linked synthesis with mem: refs and cached-source provenance over verbose narration. Cache-first research (check cache/ before web fetch, cite mem:cache/fetch/...) and right-size memories (≤3 paras, about-first) are expected defaults. When presenting options, score them (-2..+2) per mem:architecture/adr-rules.

Biases: prefers DevContainer-first, typed-scope discipline per mem:typed-memory-scopes.md, progressive disclosure (256c L0 → 4000c L1 → full L2), and verification reads after every write. Dislikes speculative abstractions and un-sourced claims — every claim should trace to mem:cache/* or mem:researches/* via claim_ids.
