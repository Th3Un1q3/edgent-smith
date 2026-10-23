---
id: researches/fresh-reader-audit/serena-memory-skill
type: researches
L0: "Fresh-reader audit of the serena-memory skill: 31 defects; 25 worst recorded (provenance stamps, self-referential history, dangling refs, contradictions)."
provenance: read-only audit of .agents/skills/serena-memory (13 files, 1235 lines)
---

# Fresh-reader audit — .agents/skills/serena-memory

Scope: SKILL.md, 7 references, 4 workflows, 1 recipe. 13 files, 1235 lines. 31 findings; 25 worst listed, ~6 minor omitted.

1. SKILL.md:9 — "1.4.11 — replaced the discovery and sandbox script chain with direct tools.gateway calls; 1.4.10 —" — release history in frontmatter; a reader needs the rule, not the delta wall.
2. SKILL.md:36 — "// or [\"tavily_search\"], [\"get_file_contents\"]" — unrelated tools dangling inside the mandatory pre-flight.
3. SKILL.md:49 — "always prefix filter topic:\"<domain>\" + slice(0,32) + sort" — slice of what? no object, cannot act.
4. gateway-protocol.md:57 — "Verified 2026-10-23 in a live session" — provenance stamp, not a rule.
5. gateway-protocol.md:62 — "flipping gateway_* from deny to allow took the visible catalog from three tools to 255" — unverifiable session anecdote in a spec.
6. gateway-protocol.md:39 — "a human performs the store or recall and records the memory id" — no trigger, no actor for an agent-facing doc.
7. gating.md:81 — "skill copy .agents/skills/serena-memory/scripts/validate_memory_frontmatter.py deleted" — documents a deletion rather than a rule.
8. gating.md:36 — "Gate script inside gateway_mcp-exec" — contradicts SKILL.md:40 "BAD: a code-mode or mcp-exec script for a single call".
9. gating.md:53 — "fm && fm.L0 && fm.L0.length<=256 || fm===null" — passes when frontmatter is absent, defeating Disclosed.
10. gating.md:11 — "rename still passes Discoverable, delete leaves about consistent" — garbled; no verification step, reader cannot act.
11. gating.md:60 — "var raw = list_memories({ topic: \"entities\" })" — bare call contradicts the mandatory tools.gateway shape in the same skill.
12. typing.md:32 — "preferences/*flat vs profile/preferences/* nested (top-level preferences:0 empty, use profile/preferences)" — contradicts the path in its own row.
13. typing.md:25 — "Experiences aggregate 3 trajectories → hint describes experience content, not its topic prefix" — "hint" undefined; orphan line.
14. typing.md:15 — "Do not duplicate that table here." — commentary on the document's own composition.
15. typing.md:69 — "typed as researches/ prefix but may lack type: frontmatter" — self-contradictory definition.
16. disclosure.md:21 — "Legacy noFM (491 files)" — hand-maintained count baked into a rule; unverifiable.
17. frontmatter.md:58 — "topic:\"ci-failures\" returns {} (0) while topic:\"ci\" returns 1" — observed counts; also contradicts typing.md:53 "prefix matching".
18. frontmatter.md:52 — "pending * 0.10 >= 1 triggers parent review" — "pending" never defined; formula cannot be applied.
19. lifecycle.md:17 — "10% audit — audit 10% of merged memories for accuracy" — no auditor, no accuracy measure.
20. recall-memory.md:3 — "Shaping exemption: ... single source per Rule19/Rule24 ... Flag threshold 250, not 120" — internal skill-authoring meta; rule numbers dangle.
21. recall-memory.md:47 — "0.6*BM25+0.1*hotness" vs code "0.6*bm25 + 0.3*vec + 0.1*hot" — weights disagree.
22. store-memory.md:36 — "build FM via normalizeFM" — helper is defined only in a later snippet; undefined at point of use.
23. manage-memory.md:49 — "JSON.parse(list_memories({}))" vs gateway-protocol.md:60 result envelope — one call parsed two incompatible ways.
24. evolve-memory.md:27 — "retry once" vs gateway-protocol.md:29 "not a retry signal" — direct contradiction, zero-retry rule broken.
25. consolidate.md:46 — "var approved = true; // operator sets true" — hardcodes the human gate open.

Minor, not detailed: consolidate.md:24 "Activate serena sandbox"; evolve-memory.md:30 "in the same call"; recall-memory.md:72 duplicate orphan line; frontmatter.md:43 tooling/* missing from the typing.md exempt list; gating.md:51 "minimal: memory.length < 4000"; store-memory.md:12 "L2 full with 700c excerpt, 2 KB tool cap".
