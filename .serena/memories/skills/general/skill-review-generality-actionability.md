# Skill Review: Generality, Actionability, Principles-First

Round-2 de-overfit of the context-gathering skill (2026-08-07) proved a structural review checklist misses first-time-reader defects. When reviewing/authoring skills:

- **Generality** — no overfit to the originating task ("generic" caching recipe held 44 YouTube mentions; a YouTube-only rule became root "canonical"). General workflow leads; specific applications are LABELED example sections at the end.
- **Actionability** — every numeric/behavioral rule needs a copy-pasteable worked example (the ≤2 KB truncation rule had zero JS in 22 files).
- **Principles before instances** — state general invariants (verify-after-write) generically, then apply per store; never scope a general rule to one store type.

Source: operator review (context-gathering v1.15.0). Related: mem:skills/general/context-gathering-version-deltas; mem:skills/general/skill-principles-active-voice.