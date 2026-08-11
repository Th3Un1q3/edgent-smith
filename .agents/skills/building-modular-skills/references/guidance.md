# Reference: Rules — the 13 Shaping Rules

This reference carries the canonical rules behind the index-and-router skill structure. Each rule names a directive, states why it matters, and points to the file where it applies. [workflows/shaping-checklist.md](../workflows/shaping-checklist.md) turns these 13 rules into the completion gate — one check per rule.

**When to load:** whenever you author, rework, or review a modular skill and need the reasoning behind the structure rules; before you run the [Shaping Checklist](../workflows/shaping-checklist.md) to declare a skill complete; whenever a review flags a rule violation.

## How to use this reference

Read the rule behind a failing checklist check. Run the gate first; when a check fails, find its rule here, apply the fix, then re-run the check. The table at the bottom maps each rule to its checklist check and the file where it applies.

## Vocabulary

These terms carry load-bearing meaning. Define each once in a Vocabulary line; reuse the term verbatim everywhere else. Decode non-load-bearing jargon inline.

- **rule** — a directive the Shaping Checklist verifies; the 13 rules map one-to-one to the 13 checks.
- **root** — the always-loaded SKILL.md; the skill's index and router.
- **workflow** — a step-by-step file under `workflows/`, loaded only when the task matches.
- **reference** — a factual detail file under `references/`, loaded only when the task matches.
- **routing table** — the completeness contract; every file gets one row.
- **applicability** — the When to Use / Not Use sections that decide when a skill triggers.
- **overmatching** — triggering when the skill should not, from a too-broad description.
- **clarification triggers** — questions to ask before authoring when the request is ambiguous.
- **guardrails** — numeric limits (line budgets, token caps) that prevent bloat.
- **completion gate** — the mandatory [Shaping Checklist](../workflows/shaping-checklist.md); one unchecked box means the skill is NOT complete.
- **"Implements:"** — a line wiring a rule to its worked example.
- **recipe** — a step-by-step reusable procedure under `recipes/`.
- **script** — an executable helper under `scripts/`.

## Rule 1: Keep the root lean

Root is the always-loaded surface. Every line costs tokens on every trigger. Keep root = metadata + triggers + minimal workflow skeleton + one-line cross-cutting principles + routing + related skills. Keep the root at or under ~90 lines; evict sub-domain rule prose to the owning reference; keep one pointer line. The workflow skeleton holds pointers, not workflow steps. Each cross-cutting principle fits on one line.

Root loads on every trigger; workflows and references load only on match. A long root raises token cost on every trigger and buries the routing table.

**Audit method:** grep the root for sub-domain vocabulary — budget numbers, key schemes, phase labels. Literal rule prose is the smell. Routing-table triggers are fine.

**Applied in:** [SKILL.md](../SKILL.md) root layout; [authoring-workflow.md](../workflows/authoring-workflow.md) step 4.

## Rule 2: Write principles in active voice

Principles are directives with active-verb kickers. "Verify every write" is a directive; "Cache discipline" is a topic label. State one idea per sentence. Ban "step 0", "(general)", and bare phase labels from principle text.

Noun labels name a topic; they tell the model nothing to do. Active verbs give the model an action to take.

**Applied in:** [SKILL.md](../SKILL.md) Principles section; [authoring-workflow.md](../workflows/authoring-workflow.md) principles step.

## Rule 3: Define jargon once

Define load-bearing terms once in a Vocabulary line in the relevant reference; decode non-load-bearing jargon inline at first use. Keep factual tool names as-is; define or replace conceptual jargon. Define-don't-delete: terms that recipes use must survive renames.

Undefined jargon forces readers to guess; guessed meanings drift. Recipes and workflows break when the term they use disappears.

**Applied in:** Vocabulary lines in reference files.

## Rule 4: Comply with the writing style

Skill prose must comply with [writing-style.instructions.md](../../../../.opencode/instructions/writing-style.instructions.md). Write kicker-first, active voice, one idea per sentence. Use no nominalizations, no stop-words, no passive. State concrete numbers.

Skill prose is instruction a model executes. Nominalizations and passives blur who does what.

**Applied in:** every file this skill owns. [shaping-checklist.md](../workflows/shaping-checklist.md) check 4 spot-checks compliance.

## Rule 5: Generalize beyond the originating task

Do not overfit to the originating task. Let the general workflow lead. Put specific applications in clearly-labeled "Example application:" sections at the end of the file.

A skill overfit to one task fails every other task. The general workflow keeps the skill reusable.

**Applied in:** [guidance.md](./guidance.md) "Example application: shaping a skill" below; [authoring-workflow.md](../workflows/authoring-workflow.md) examples step.

## Rule 6: Wire every rule to a worked example

Every numeric or behavioral rule needs a copy-pasteable worked example. Wire the example to the rule with an "Implements: [reference] §N — ..." line. A rule without an example is incomplete.

Rules without examples leave the model to invent code; invented code drifts from intent. The "Implements:" line pins the example to its rule so the reader sees the connection.

**Applied in:** [templates.md](../references/templates.md) example pattern; [guidance.md](./guidance.md) "Example application: shaping a skill" below.

## Rule 7: State principles before instances

State general invariants in the root; apply them per instance in recipes. Never scope a general invariant to one instance — one store, one tool, one task. Verify-after-write is general, not scoped to one instance.

A rule scoped to one instance reads as a special case. Readers miss the general invariant when prose names one instance.

**Applied in:** [SKILL.md](../SKILL.md) Principles; [authoring-workflow.md](../workflows/authoring-workflow.md) decomposition step.

## Rule 8: Keep routing complete

Every file gets a routing row in the root — templates included. The routing table is the completeness contract. Adding a file without a row is a defect.

An unlinked file never loads; the model cannot reach it. The routing table makes file coverage checkable at a glance.

**Applied in:** [SKILL.md](../SKILL.md) Task Routing Table. [shaping-checklist.md](../workflows/shaping-checklist.md) check 8 verifies it.

## Rule 9: Orient the first-time reader

Every recipe and workflow opens with tools (or a pointer to them), prerequisites, and order of operations. Decode jargon or define it inline.

A reader without tools or order wastes tokens discovering both. Orientation lets the reader start the first step immediately.

**Applied in:** workflow and recipe file headers; [templates.md](../references/templates.md) workflow template.

## Rule 10: Write acceptance criteria

Write measurable pass/fail acceptance criteria per recipe and workflow.

Unmeasurable criteria block grading.

**Applied in:** [authoring-workflow.md](../workflows/authoring-workflow.md) acceptance criteria; [templates.md](../references/templates.md) workflow template.

## Rule 11: Guard parallel edits

Declare canonical tokens (tool names, section anchors, principle names) centrally. Verify cross-file references resolve. Validation greps the full tree for stale naming.

Parallel editors diverge when each renames a different occurrence. Full-tree greps catch what partial sweeps miss.

**Applied in:** central token declarations in [SKILL.md](../SKILL.md); full-tree validation at [shaping-checklist.md](../workflows/shaping-checklist.md) check 11.

## Rule 12: Version every change

Bump the version on every content change. Record deltas so future sessions verify against disk, not stale text.

Unversioned content leaves future sessions comparing against stale text. A delta note records what moved and why.

**Applied in:** `metadata.version` in [SKILL.md](../SKILL.md) frontmatter; [templates.md](../references/templates.md) frontmatter template.

## Rule 13: Practice what you preach

Audit your own skill against this checklist. A skill about skills must pass its own gate.

A gate that fails its owner proves nothing. Passing your own gate makes the checklist credible.

**Applied in:** [shaping-checklist.md](../workflows/shaping-checklist.md) check 13 — the checklist applies to this skill too.

## How the rules map to the gate

Each checklist check in the Shaping Checklist maps one-to-one to a rule here. Fix the rule, then re-run the check.

| Rule | Checklist check | File where it applies |
|---|---|---|
| 1 Keep the root lean | 1 | SKILL.md root |
| 2 Write principles in active voice | 2 | SKILL.md Principles |
| 3 Define jargon once | 3 | reference Vocabulary lines |
| 4 Comply with the writing style | 4 | every skill file |
| 5 Generalize beyond the originating task | 5 | workflows, references |
| 6 Wire every rule to a worked example | 6 | references with rules |
| 7 State principles before instances | 7 | SKILL.md Principles |
| 8 Keep routing complete | 8 | SKILL.md Task Routing Table |
| 9 Orient the first-time reader | 9 | workflows, recipes |
| 10 Write acceptance criteria | 10 | workflows, recipes |
| 11 Guard parallel edits | 11 | whole skill tree |
| 12 Version every change | 12 | SKILL.md frontmatter |
| 13 Practice what you preach | 13 | the whole skill |

## Example application: shaping a skill

This section is a labeled example at the end of the file, per Rule 5. It demonstrates Rules 1, 3, 6, and 8 on a fictional tree; `skill-name` is a placeholder, not a real skill.

- **Tree:** `skill-name/` holds SKILL.md, `workflows/`, `references/`, `recipes/`, and `scripts/`. The root routes to every file.
- **Lean root (Rule 1):** SKILL.md runs ~20 lines: metadata, When to Use, routing table, Related Skills. It carries one pointer line per file and no sub-domain rule prose.
- **Root sketch (Rule 1):** one routing row reads `| references/templates.md | template patterns | load on authoring |`. The row points; the rules live in the file.
- **Vocabulary line (Rule 3):** `references/templates.md` opens with `- **snippet** — a reusable code block with a named rule citation.`
- **Routing row (Rule 8):** the routing table lists every file, templates included; adding a file without a row is a defect.
- **Worked example (Rule 6):** `recipes/example.md` opens with `Implements: [templates.md] §2 — every snippet names its rule.`

The general guidance leads; this section stays labeled and last. It is the reference's own worked example for Rule 6.
