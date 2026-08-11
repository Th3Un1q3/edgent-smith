# Building-Modular-Skills Contradiction-Resolution Pass

building-modular-skills resolved to v3.1.0 on 2026-08-10 (second pass; validated PASS — all changes checked). The v3.1.0 pass rewrote references/guidance.md as skill-agnostic rule guidance: all "lesson" terminology is GONE, the 13 items are now `## Rule N:` headers, and the load-bearing mapping is the 13-check <-> 13-rule mapping (numbering preserved, one check per rule). This CORRECTS the v3.0.0 record "lesson survives as load-bearing content" framing — that framing is obsolete; "lesson" no longer appears in the skill.

## Canonical State (2026-08-10, v3.1.0)

1. **guidance.md is rule-based, skill-agnostic guidance** — 13 `## Rule N:` headers, each with a directive, a rationale, and "Applied in" links. The 13-check <-> 13-rule mapping table is load-bearing (one-to-one, numbering preserved). SKILL.md routing label: "Need the rules, Vocabulary line, or the guidance behind the checks"; the checklist closing line: checks "map one-to-one to the rules in references/guidance.md; read the rule behind a failing check before fixing".
2. **All context-gathering references removed from guidance.md** — the "Example application: context-gathering" section is gone, replaced by a self-contained generic "Example application: shaping a skill" (fictional `skill-name` tree demonstrating Rules 1/3/6/8); the "canonical exemplar" Vocabulary entry, HIT/MISS/about-first/gateway_mcp-find/serena examples, and caching-rules/truncation-examples/memory-management-checklist precedent links are deleted; the "46-line cache rulebook" and "5 stale tokens" anecdotes are gone (also removed from checklist check 11, now "Parallel-edit safe").
3. **QA-driven rewrite** — every guidance.md line was QAed against .opencode/commands/prompt-qa.md; 10 high-confidence findings (false "102 lines" exemplar claim; orphaned worked examples; lesson/rule terminology split; missing ~90-line criterion in Rule 1; unverifiable anecdotes; definition-placement conflict; unquantified "one-line principles"/"minimal workflow skeleton"; Rule 7 "store type"/"memory-only" jargon; Rule 3 context-gathering examples; 17 context-gathering occurrences) — all 10 resolved. Checklist check 7 was genericized to match Rule 7 ("one instance", not "store type"/"memories only").
4. **Version bumped 3.0.0 -> 3.1.0** — delta: "guidance.md rewritten to rule-based guidance; context-gathering case study removed; prompt-qa findings addressed".
5. **USER-OWNED: guidance.md Rule 4 writing-style link** — Rule 4 links `writing-style.instructions.md` to the `.opencode/instructions/` copy (a live link; checklist check 4 and authoring-workflow point at `.github/instructions/`). This is a deliberate, user-owned edit. Do NOT flag or change it; future sessions must leave it alone.
6. **Intentional scope: exemplar mentions stay** — SKILL.md L22/L67 and authoring-workflow.md L10 still name context-gathering as the canonical exemplar. User decision: removal was scoped to guidance.md only. Leave intact.

## Files (5 remain)

- SKILL.md (68 lines)
- workflows/authoring-workflow.md (49)
- workflows/shaping-checklist.md (71)
- references/guidance.md (166)
- references/templates.md (134)

## Process Lessons

1. **Verify plan assumptions against the disk before trusting "no change needed"** — stale line numbers and assumed formats silently invalidate plan sections (v3.0.0 pass).
2. **When changing a routing/template policy, grep for the OLD policy language everywhere** — the last survivor contradicts the new policy until caught (v3.0.0 pass).
3. **After parallel subagent edits, run a final ground-truth pass** — file listing, greps, link audit; intermediate reports conflict (v3.0.0 pass).
4. **Mandated delta strings are sanctioned occurrences of banned terms** — validators must whitelist version-record text, not treat it as a violation (v3.0.0 pass).
5. **When renaming core terminology, the cross-file audit must cover the paired CHECK as well as the reference** — checklist check 7 retained the old jargon ("store type", "memories only") after Rule 7 was genericized, creating a one-to-one mapping inconsistency (check 7 <-> Rule 7) until caught by review (v3.1.0 pass).

## Follow-ups for Future Sessions (verify current state before acting)

- templates.md has no recipe/script skeletons despite routing-table rows advertising them (root template rows for `recipes/x.md` and `scripts/x.md` exist) — still open.
- SKILL.md frontmatter description still enumerates only workflow/reference files — still open (intentional, per earlier directive).
- SKILL.md L22/L67 + authoring-workflow L10 keep context-gathering as the canonical exemplar — intentional user scope; leave alone.
- guidance.md Rule 4 writing-style link points at the `.opencode/instructions/` copy — user-owned; leave alone.
- RESOLVED in v3.1.0: "apply per store" (old Lesson 7) vs "apply per instance" wording drift — check 7 and Rule 7 now both say per instance / one instance.

Source: operator-validated post-pass report (2026-08-10, v3.1.0); file inventory and content per ground-truth pass on observed files.
