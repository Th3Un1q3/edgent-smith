# Workflow: Shaping Checklist — the Completion Gate

Run this before declaring any skill complete — including this one. One unchecked box means the skill is NOT complete. The root points here as the completion gate.

**When to load:** before you declare a skill complete; after authoring or reworking a modular skill; whenever the root says "run the Shaping Checklist".

## How to run the gate

1. Work through the 24 checks in order.
2. Mark a box checked only when its pass statement holds.
3. Run the self-audit command where one exists; confirm the output matches the stated pass.
4. One unchecked box means the skill is NOT complete — fix the item, then re-run the gate from the top.
5. The 24 checks map one-to-one to rules 1–24 in [references/guidance.md](../references/guidance.md); read the rule behind a failing check before fixing.

## The 24 checks

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

4. **Writing style** — Pass: prose complies with [writing-style.instructions.md](../../../../.opencode/instructions/writing-style.instructions.md) — kicker-first, one idea per sentence, concrete numbers (see Rule 4).
   Spot-check a sample of body sentences against the style file.
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

8. **Routing complete** — Pass: every file has a routing row — workflows, references, recipes, domain scripts, templates included; shared audit tooling in `agent_utils/scripts/` exempt per Rule 8 exception (see Rule 8).
   Run: `grep -c '^| ' SKILL.md` — expect one row per file in the skill tree plus one for the header row; skill-tree files = every file under `workflows/`, `references/`, `recipes/`, `scripts/` (domain helpers only), templates included; exclude shared `audit_fences.py`/`validate_md_links.py`.
   *If not:* fix per Rule 8 — add one routing row per domain file and re-count.

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
    Run: the Rule 14 audit command in [guidance.md](../references/guidance.md) (run from the skill's root) — expect no matches outside the exception categories Rule 14 documents: metadata.delta, the audit command itself, the rule's enumeration, label-placement guidance, and the checklist's gate text (checks 6, 14, 23).
    *If not:* fix per Rule 14 — delete or rewrite each hit to teach the subject; move author-process records to `metadata.delta`.

15. **Fences valid** — Pass: every code fence valid for its declared language; every ```json fence parses with `json.loads`; no comment lines inside JSON fences; multi-document fragments wrapped in arrays or split; `~~~~` fences audited like `` ``` `` fences (see Rule 15).
   Run: `python3 agent_utils/scripts/audit_fences.py .agents/skills/<name>` — or `python3 agent_utils/scripts/audit_fences.py .` from the skill root (see [guidance.md](../references/guidance.md) Rule 15) — expect zero violations printed. Also run `python3 agent_utils/scripts/validate_md_links.py .agents/skills/<name>` per Rule 15.
   *If not:* fix per Rule 15 — wrap or split multi-document fences; strip comment lines from JSON fences; re-run until silent.

16. **Examples match facts** — Pass: every example uses the shapes, schema, labels, and option keys the skill's own references define; no legacy or invented format contradicts a reference (see Rule 16).
    Run: the Rule 16 audit in [guidance.md](../references/guidance.md) — expect no example contradicting a reference the skill ships.
    *If not:* fix per Rule 16 — update the reference first, then rewrite every example that uses it.

17. **Failure-mode-driven** — Pass: the description and When to Use name the agent failure mode the skill fixes; no structural mandate appears without a failure to justify it (see Rule 17).
    Read the frontmatter description and When to Use; confirm they name a failure, not a topic.
    *If not:* fix per Rule 17 — name the failure in the description; cut structure the failure does not require.

18. **Description dialect** — Pass: the frontmatter description matches the invocation path — a human-facing one-liner for user-invoked skills, a trigger-rich model-facing description for model-invoked skills (see Rule 18).
    Read the description; confirm the dialect matches how the skill gets invoked.
    *If not:* fix per Rule 18 — rewrite the description for the invocation path.

19. **Progressive disclosure** — Pass: always-loaded content minimal; detail in companion files; every reference section = one idea; budgets hold (see Rule 19).
    Run: `wc -l SKILL.md references/*.md` — expect root ≤ ~90; flag a reference over ~250 lines for splitting unless it is the rules reference.
    *If not:* fix per Rule 19 — push detail down or split the reference.

20. **Executable with completion criteria** — Pass: every instruction executable or gated; steps state a "Done when:" signal; hard gates and honest out-of-scope lists present (see Rule 20).
    Spot-check each step for a completion signal and each phase for a gate.
    *If not:* fix per Rule 20 — add completion criteria per step; add gates and out-of-scope lists.

21. **Positive prompting** — Pass: every behavioral prohibition carries a positive reframe; no no-op instructions in the reader path (see Rule 21).
    Run: grep the teaching files (SKILL.md, references/, workflows/) for `Do not|Never|no` — exempt structural negatives: "When Not to Use" scope sections, routing and scope statements, quoted examples that demonstrate a reframe, and this checklist's own pass statements. Expect every remaining negative beside a positive reframe.
    *If not:* fix per Rule 21 — add the reframe next to each prohibition; prune no-ops.

22. **Composed via explicit calls** — Pass: cross-skill invocation names the Skill tool explicitly; primitives referenced by path, not re-described (see Rule 22).
    Read cross-skill references; confirm they name the tool and point to the primitive.
    *If not:* fix per Rule 22 — name the tool; point to the primitive.

23. **Nothing invented** — Pass: every fact and example verified against a trusted source or the skill's own references; no invented behavior; no user questions for look-up-able facts (see Rule 23).
    Cross-check each factual claim and example against its source.
    *If not:* fix per Rule 23 — verify, resolve, and look facts up yourself.

24. **Single source of truth** — Pass: no content duplicated across files; duplicates replaced by path or URL references (see Rule 24).
    Run: grep for phrase blocks repeated across files — expect no duplicate prose.
    *If not:* fix per Rule 24 — keep one source of truth; reference by path.
