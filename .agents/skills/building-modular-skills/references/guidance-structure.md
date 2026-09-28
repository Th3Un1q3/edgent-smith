# Reference: Structure Rules — the Shaping Rules

This reference carries the structure rules behind the index-and-router layout: where content lives and how files are routed. Each rule names a directive, states why it matters, and points to the file where it applies. [workflows/shaping-checklist.md](../workflows/shaping-checklist.md) turns the shaping rules into the completion gate — one check per rule. Rules 1, 2, 7, 8, 9, and 19 live here; [guidance-content.md](./guidance-content.md) holds the content rules (3, 4, 5, 6, 14, 15, 16, 21); [guidance-process.md](./guidance-process.md) holds the process rules (10, 11, 12, 13, 17, 18, 20, 22, 23, 24, 25), the anti-patterns pointer, and the worked example. Rule numbering stays stable across the split.

**When to load:** whenever you author, rework, or review a modular skill and need the reasoning behind the structure rules — root leanness, principle wording, routing, and progressive disclosure; before you run the [Shaping Checklist](../workflows/shaping-checklist.md) to declare a skill complete; whenever a review flags a structure-rule violation.

## How to use this reference

Read the rule behind a failing checklist check. Run the [Shaping Checklist](../workflows/shaping-checklist.md) first — it runs the fix→re-run loop; this file holds the reasoning.

## Vocabulary

These terms carry load-bearing meaning. Define each once in a Vocabulary line; reuse the term verbatim everywhere else. Decode non-load-bearing jargon inline.

- **rule** — a directive the Shaping Checklist verifies; the 24 shaping rules map one-to-one to the 24 checks, and Rule 25 is a cross-cutting constraint verified alongside check 22.
- **root** — the always-loaded SKILL.md; the skill's index and router.
- **file type** — a file under `workflows/`, `references/`, `recipes/`, or `scripts/`; loads only when the task matches.
- **routing table** — the completeness contract; every file gets one row.
- **applicability** — the When to Use / Not Use sections that decide when a skill triggers.
- **overmatching** — triggering when the skill should not, from a too-broad description.
- **clarification triggers** — questions to ask before authoring when the request is ambiguous.
- **guardrails** — numeric limits (line budgets, token caps) that prevent bloat.
- **completion gate** — the mandatory [Shaping Checklist](../workflows/shaping-checklist.md); one unchecked box means the skill is NOT complete.
- **"Implements:"** — optional label wiring a rule to its worked example; allowed only in prose outside code fences, never inside one.
- **failure mode** — a named way an agent run goes wrong; a skill exists to fix one.
- **progressive disclosure** — keeping always-loaded content minimal and pushing detail to files that load on match.
- **positive reframe** — the actionable instruction that replaces a prohibition; say what to do, not what to avoid.
- **no-op instruction** — guidance the model already obeys by default; it pays load to say nothing.
- **trigger-rich description** — a frontmatter description packed with user-phrase triggers so auto-invocation fires.

## Rule 1: Keep the root lean

Root is the always-loaded surface. Every line costs tokens on every trigger. Keep root = metadata + triggers + minimal workflow skeleton + one-line cross-cutting principles + routing + related skills. Keep the root at or under ~90 lines; evict sub-domain rule prose to the owning reference; keep one pointer line. The workflow skeleton holds pointers, not workflow steps. Each cross-cutting principle fits on one line.

Root loads on every trigger; workflows and references load only on match. A long root raises token cost on every trigger and buries the routing table.

**Audit method:** grep the root for sub-domain vocabulary — budget numbers, key schemes, phase labels. Literal rule prose is the smell. Routing-table triggers are fine.

**Applied in:** [SKILL.md](../SKILL.md) root layout; [authoring-workflow.md](../workflows/authoring-workflow.md) step 4.

## Rule 2: Write principles in active voice

Principles are directives with active-verb kickers. "Verify every write" is a directive; "Cache discipline" is a topic label. State one idea per sentence. Ban "step 0", "(general)", and bare phase labels from principle text.

Noun labels name a topic; they tell the model nothing to do. Active verbs give the model an action to take.

**Applied in:** [SKILL.md](../SKILL.md) Principles section; [authoring-workflow.md](../workflows/authoring-workflow.md) principles step.

## Rule 7: State principles before instances

State general invariants in the root; apply them per instance in recipes. Never scope a general invariant to one instance — one store, one tool, one task. Verify-after-write is general, not scoped to one instance.

A rule scoped to one instance reads as a special case. Readers miss the general invariant when prose names one instance.

**Applied in:** [SKILL.md](../SKILL.md) Principles; [authoring-workflow.md](../workflows/authoring-workflow.md) decomposition step.

## Rule 8: Keep routing complete

Every file gets a routing row in the root — templates included. The routing table is the completeness contract. Adding a file without a row is a defect.

Exception: shared tooling under `agent_utils/scripts/` (`audit_fences.py`, `validate_md_links.py`) is single source per Rule 24; do not copy into per-skill `scripts/` and do not add routing rows for these shared scripts. Per-skill `scripts/` holds domain-specific helpers only.

An unlinked file never loads; the model cannot reach it. The routing table makes file coverage checkable at a glance.

**Applied in:** [SKILL.md](../SKILL.md) Task Routing Table. [shaping-checklist.md](../workflows/shaping-checklist.md) check 8 verifies it.

## Rule 9: Orient the first-time reader

Every recipe and workflow opens with tools (or a pointer to them), prerequisites, and order of operations. Decode jargon or define it inline.

A reader without tools or order wastes tokens discovering both. Orientation lets the reader start the first step immediately.

**Applied in:** workflow and recipe file headers; [templates-workflow-reference.md](./templates-workflow-reference.md) workflow template.

## Rule 19: Disclose progressively; sprawl is the failure mode

Keep always-loaded content minimal; push detail into companion files that load on match. Push too little down and the top bloats; push too much and you hide material the agent actually needs. Budgets: root ≤160 lines (hard gate; keep it near the ~90-line target of Rule 1); each reference ≤120 lines; each reference section = one idea; split a reference before it exceeds 120 — rule numbering stays stable across the split files. Reusable audit tooling lives in `agent_utils/scripts/` as single source per Rule 24 (exception to Rule 8); domain-specific helpers live under per-skill `scripts/`; one-line greps stay with the rule that teaches them.

Sprawl is the failure mode: a document simply too long buries the actionable step.

**Example:** a ~90-line root carries one pointer line per file; the 30-line option detail sits in `references/options.md`, loaded on match.

**Applied in:** [SKILL.md](../SKILL.md) root; [templates-root.md](./templates-root.md) root template; [authoring-workflow.md](../workflows/authoring-workflow.md) step 3; `agent_utils/scripts/audit_fences.py`.
