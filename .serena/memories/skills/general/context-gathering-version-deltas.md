# Context-Gathering Skill Version Deltas

Canonical state as of 2026-08-07: **v1.17.0** (root SKILL.md = 102 lines, verified against disk). Root holds frontmatter, intro, When-Not-to-Use, Context Sources, Minimal Workflow, 8 cross-cutting Principles (active-voice one-liners with pointers), Immutable Memory Rules, 3-bullet Common Issues, 21-row Task Routing Table, Related Skills. Future sessions must read .agents/skills/context-gathering/SKILL.md — do not assume older rule text.

Round 4 (2026-08-07) writing-style rewrite:
- 8 Principles rewritten from noun-phrase labels to active-voice kicker directives: "Script once, sandbox once", "Trust the gateway's authentication", "Recall existing memories first", "Verify every write" (was "Verify after write (general)"; "(general)" dropped), "Store research output in memory, not files" (was "Precedence rule"; "STORE phase" dropped), "Start with the lightest server", "Cache external context" (was "Cache discipline"), "Budget model context".
- NEW Vocabulary line (caching-rules.md §3) defines load-bearing jargon once: HIT/MISS, `mem:` refs, OK/FAIL <name> chars=<n> pages=<n>, about-first, CHECK→FETCH→STORE→SYNTHESIZE, HARVEST. Define, don't delete — 36 HIT / 47 MISS / 90 mem: / 12 HARVEST sites and evals stayed intact.
- Renames propagated: "Verify every write" in memory-management-checklist, server-selection, external-content-caching (×2), caching-rules; "Store research output in memory, not files" in server-selection. "(generic)"/"(general)"/"(STORE)" qualifiers dropped; "step 0" → "first". Wording now complies with .github/instructions/writing-style.instructions.md (active voice, kicker-first, one idea per sentence, no nominalizations).
- Lesson: mem:skills/general/skill-principles-active-voice.

Round 3 (2026-08-07) root-leanness (history): root slimmed 175 → 102 lines; ~46-line cache rulebook moved wholesale to references/caching-rules.md (68 lines, 11 sections); one pointer line + one routing row remain. "Verify after write (general)" and precedence rule stayed in root then; round 4 renamed both. Routing table 20 → 21 rows.

Round 2 (2026-08-07) de-overfit (history): generic verify-after-write principle; 20-row routing; external-content-caching.md generic Stages 1–9 with YouTube demoted to labeled example; NEW references/truncation-examples.md; orientation pointers; evals/evals.json rewrites.

Related: mem:skills/general/context-gathering-tool-stack; mem:skills/general/skill-root-leanness; mem:skills/general/skill-review-generality-actionability; mem:skills/general/skill-principles-active-voice; mem:subagent-workflows/parallel-edits-cross-file-references.