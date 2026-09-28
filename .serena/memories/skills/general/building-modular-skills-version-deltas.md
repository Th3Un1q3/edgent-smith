# Building-Modular-Skills Version Deltas

Canonical state: **v3.5.0** — 24 rules (16:16 → 24:24; rules 17–24 appended, 1–16 unrenumbered). **SUPERSEDED (historical record):** the current skill is **v4.0.0 — 25 rules**, restructured by topic: the monolithic `references/guidance.md` (and the interim `guidance-rules-10-19.md` / `guidance-rules-20-24.md` split) is deleted; rules now live in `references/guidance-structure.md` (Rules 1,2,7,8,9,19 + Vocabulary), `references/guidance-content.md` (Rules 3,4,5,6,14,15,16,21), and `references/guidance-process.md` (Rules 10,11,12,13,17,18,20,22,23,24,25 + example application). Future sessions must read .agents/skills/building-modular-skills/ — do not assume older rule text.

v3.5.0 additions (2026-08-20, skill-quality campaign):

- 17 failure-mode-driven design — each rule exists because an observed failure caused it.
- 18 description dialects — user-invoked = human one-liner; model-invoked = trigger-rich.
- 19 progressive disclosure + reference budgets — root ≤ ~90 lines; split references past ~250 lines.
- 20 "Done when:" completion criteria, hard gates, "It's working if" honest limits.
- 21 leading words + positive prompting; no-op pruning.
- 22 explicit skill-tool composition.
- 23 never-invent / verify facts — facts are the agent's job.
- 24 single source of truth — reference by path.

New references/anti-patterns.md: the 9 mattpocock anti-patterns with positive reframes and a map table linking each to the rule that prevents it (mem:skills/general/mattpocock-skill-anti-patterns). Carve-outs honored: guidance-content.md Rule 4 style link; context-gathering kept as exemplar references.