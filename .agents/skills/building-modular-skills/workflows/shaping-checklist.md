# Workflow: Shaping Checklist — the Completion Gate

Run this before declaring any skill complete — including this one. One unchecked box means the skill is NOT complete. The root's Completion Gate sentence points here, and this gate applies to this skill too.

**When to load:** before you declare a skill complete; after authoring or reworking a modular skill; whenever the root's Completion Gate sentence says "run the Shaping Checklist".

## How to run the gate

1. Work through the 13 checks in order.
2. Mark a box checked only when its pass statement holds.
3. Run the self-audit command where one exists; confirm the output matches the stated pass.
4. One unchecked box means the skill is NOT complete — fix the item, then re-run the gate from the top.

## The 13 checks

1. **Root lean** — Pass: root SKILL.md is ≤ ~90 lines and carries no sub-domain rule prose.
   Run: `wc -l SKILL.md` — expect ≤ ~90.
   Run: grep the root for sub-domain rule prose — budget numbers, key schemes, phase labels from this skill's own domain — expect zero matches.
   *If not:* every trigger pays tokens for prose it does not need → evict rule prose to the owning reference; keep one pointer line.

2. **Active-voice principles** — Pass: every Principles bullet begins with an active-verb kicker, not a noun label.
   Spot-check each bullet. Accept directives like "Verify every write"; reject labels like "Cache discipline".
   *If not:* noun labels tell the model nothing to do → rewrite each label as a directive with an active verb.

3. **Vocabulary defined** — Pass: every load-bearing term appears in a Vocabulary line in the relevant reference.
   List the terms the skill uses; confirm each appears in a Vocabulary line once.
   *If not:* readers guess meanings and guesses drift → define each term once; keep terms that recipes and workflows use.

4. **Writing style** — Pass: no nominalizations, stop-words, or passive constructions.
   Spot-check against [writing-style.instructions.md](../../../../.github/instructions/writing-style.instructions.md). Confirm kicker-first structure, one idea per sentence, concrete numbers.
   *If not:* blurred prose produces blurred behavior → rewrite each sentence with a clear subject and an active verb.

5. **General** — Pass: no overfit to the originating task; specific applications sit in labeled "Example application:" sections at the end.
   Read the workflow; confirm the general path leads and examples follow as labeled sections.
   *If not:* a skill that serves one task fails every other → promote the general workflow to the lead; label applications.

6. **Actionable** — Pass: every numeric or behavioral rule carries an "Implements:" worked example.
   Find each numeric rule; confirm a copy-pasteable example cites it with an "Implements: [reference] §N — ..." line.
   *If not:* models invent code and drift from intent → wire a complete example to each rule.

7. **Invariants generic** — Pass: cross-cutting rules live in the root, not scoped to one instance.
   Check the root Principles; confirm each states a general invariant. Verify-after-write must not be scoped to one instance.
   *If not:* readers treat a general rule as a special case → restate the invariant generally in the root; apply it per instance in recipes.

8. **Routing complete** — Pass: every file appears in the routing table — workflows, references, recipes, scripts, and templates; adding a file without a row is a defect.
   Run: `grep -c '^| ' SKILL.md` — expect one row per file in the skill tree plus one for the header row; skill-tree files = every file under `workflows/`, `references/`, `recipes/`, `scripts/`, templates included.
   *If not:* an unlinked file never loads → add one routing row per file and re-count.

9. **Oriented** — Pass: every recipe and workflow opens with tools (or a pointer to them), prerequisites, and order of operations.
   Open each workflow and recipe; confirm the header names tools, prerequisites, and the first step's order.
   *If not:* readers waste tokens discovering tools and order → add a header that names tools, prerequisites, and order.

10. **Acceptance criteria** — Pass: every recipe and workflow states measurable pass/fail criteria.
    *If not:* unmeasurable criteria block grading → state pass/fail criteria per recipe.

11. **Parallel-edit safe** — Pass: canonical tokens declared centrally; the full tree holds no stale naming tokens.
    Run: `grep -rE '<stale-token-regex>' . --include='*.md'` — expect zero matches across the whole tree, not one subdirectory.
    Replace `<stale-token-regex>` with this skill's actual stale tokens (e.g., old tool names, old principle names) before running.
    *If not:* parallel edits diverge on renamed tokens → declare canonical tokens centrally; grep the full tree before finishing.

12. **Versioned** — Pass: `metadata.version` bumped on this change; deltas recorded.
    Run: `git diff SKILL.md` — confirm the version field changed and the delta note records what moved.
    *If not:* future sessions verify against stale text → bump the version and record the delta on every content change.

13. **Self-audit** — Pass: this checklist applied to this skill.
    Verify root lean, routing complete, active-voice kickers, and Vocabulary lines against this skill's own files.
    *If not:* a skill about skills that fails its own gate proves the gate is theater → fix this skill, then re-run the gate.

## Fail and fix

An unchecked box means the skill is NOT complete. Fix the failing item first, re-run that check, then re-run the gate from the top. Do not declare completion while any box stays unchecked. The 13 checks map one-to-one to the rules in [references/guidance.md](../references/guidance.md); read the rule behind a failing check before fixing.
