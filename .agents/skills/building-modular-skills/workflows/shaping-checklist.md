# Workflow: Shaping Checklist — the Completion Gate

Run this before declaring any skill complete — including this one. One unchecked box means the skill is NOT complete. The root's Completion Gate sentence points here, and this gate applies to this skill too.

**When to load:** before you declare a skill complete; after authoring or reworking a modular skill; whenever the root's Completion Gate sentence says "run the Shaping Checklist".

## How to run the gate

1. Work through the 16 checks in order.
2. Mark a box checked only when its pass statement holds.
3. Run the self-audit command where one exists; confirm the output matches the stated pass.
4. One unchecked box means the skill is NOT complete — fix the item, then re-run the gate from the top.
5. The 16 checks map one-to-one to rules 1–16 in [references/guidance.md](../references/guidance.md); read the rule behind a failing check before fixing.

## The 16 checks

1. **Root lean** — Pass: root SKILL.md ≤ ~90 lines, no sub-domain rule prose (see Rule 1).
   Run: `wc -l SKILL.md` — expect ≤ ~90.
   Run: grep the root for sub-domain rule prose — budget numbers, key schemes, phase labels from this skill's own domain — expect zero matches.
   *If not:* fix per Rule 1 — evict the prose to the owning reference; keep one pointer line.

2. **Active-voice principles** — Pass: every Principles bullet opens with an active-verb kicker, not a noun label (see Rule 2).
   Spot-check each bullet. Accept directives like "Verify every write"; reject labels like "Cache discipline".
   *If not:* fix per Rule 2 — rewrite each label as a directive with an active verb.

3. **Vocabulary defined** — Pass: every load-bearing term appears once in a Vocabulary line in the owning reference (see Rule 3).
   List the terms the skill uses; confirm each appears in a Vocabulary line once.
   *If not:* fix per Rule 3 — define each term once in the relevant reference.

4. **Writing style** — Pass: no nominalizations, stop-words, or passive constructions (see Rule 4).
   Spot-check against [writing-style.instructions.md](../../../../.github/instructions/writing-style.instructions.md): kicker-first structure, one idea per sentence, concrete numbers.
   *If not:* fix per Rule 4 — rewrite each sentence with a clear subject and an active verb.

5. **General** — Pass: no overfit to the originating task; specific applications sit in labeled "Example application:" sections at the end (see Rule 5).
   Read the workflow; confirm the general path leads and examples follow as labeled sections.
   *If not:* fix per Rule 5 — promote the general workflow to the lead; label applications.

6. **Actionable** — Pass: every numeric or behavioral rule carries a copy-pasteable worked example adjacent to it in the same section (see Rule 6).
   Find each numeric rule; confirm an example sits adjacent to it in the same section.
   *If not:* fix per Rule 6 — place a complete example next to each rule; keep "Implements:" labels in prose, never inside a fence.

7. **Invariants generic** — Pass: cross-cutting rules stated generally in the root, not scoped to one instance (see Rule 7).
   Check the root Principles; confirm each states a general invariant.
   *If not:* fix per Rule 7 — restate the invariant generally in the root; apply it per instance in recipes.

8. **Routing complete** — Pass: every file has a routing row — workflows, references, recipes, scripts, templates included; an unlisted file is a defect (see Rule 8).
   Run: `grep -c '^| ' SKILL.md` — expect one row per file in the skill tree plus one for the header row; skill-tree files = every file under `workflows/`, `references/`, `recipes/`, `scripts/`, templates included.
   *If not:* fix per Rule 8 — add one routing row per file and re-count.

9. **Oriented** — Pass: every recipe and workflow opens with tools (or a pointer to them), prerequisites, and order of operations (see Rule 9).
   Open each workflow and recipe; confirm the header names tools, prerequisites, and the first step's order.
   *If not:* fix per Rule 9 — add a header that names tools, prerequisites, and order.

10. **Acceptance criteria** — Pass: every recipe and workflow states measurable pass/fail criteria (see Rule 10).
    *If not:* fix per Rule 10 — state pass/fail criteria per recipe.

11. **Parallel-edit safe** — Pass: canonical tokens declared centrally; the full tree holds no stale naming tokens (see Rule 11).
    Run: `grep -rE '<stale-token-regex>' . --include='*.md'` — expect zero matches across the whole tree, not one subdirectory.
    Replace `<stale-token-regex>` with this skill's actual stale tokens (e.g., old tool names, old principle names) before running.
    *If not:* fix per Rule 11 — declare canonical tokens centrally; re-grep the full tree.

12. **Versioned** — Pass: `metadata.version` bumped on this change; deltas recorded (see Rule 12).
    Run: `git diff SKILL.md` — confirm the version field changed and the delta note records what moved.
    *If not:* fix per Rule 12 — bump the version and record the delta on every content change.

13. **Self-audit** — Pass: this checklist applied to this skill (see Rule 13).
    Verify root lean, routing complete, active-voice kickers, and Vocabulary lines against this skill's own files.
    *If not:* fix per Rule 13 — fix this skill, then re-run the gate.

14. **Reader-benefit** — Pass: the reader path teaches the subject; no author-process content in body prose, headings, or fences; author-process history lives only in frontmatter `metadata.delta` (see Rule 14).
    Run: the Rule 14 grep in [guidance.md](../references/guidance.md) (run from the skill's root) — expect zero matches in body prose; exceptions per Rule 14 in guidance.md.
    *If not:* fix per Rule 14 — delete or rewrite each hit to teach the subject; move author-process records to `metadata.delta`.

15. **Fences valid** — Pass: every code fence valid for its declared language; every ```json fence parses with `json.loads`; no comment lines inside JSON fences; multi-document fragments wrapped in arrays or split (see Rule 15).
    Run: the `json.loads` fence-audit script in [guidance.md](../references/guidance.md) Rule 15 (run from the skill's root directory) — expect zero lines printed.
    *If not:* fix per Rule 15 — wrap or split multi-document fences; strip comment lines from JSON fences; re-run until silent.

16. **Examples match facts** — Pass: every example uses the shapes, schema, labels, and option keys the skill's own references define; no legacy or invented format contradicts a reference (see Rule 16).
    Run: the Rule 16 audit in [guidance.md](../references/guidance.md) — expect no example contradicting a reference the skill ships.
    *If not:* fix per Rule 16 — update the reference first, then rewrite every example that uses it.
