# Verify a Consolidation, Dedupe, or Move

Use this workflow before declaring a consolidation, dedupe, or content move complete, and before deleting any prose it removes.

## When to Use

- Two or more homes state the same rule and you collapse them to one prose home plus pointers.
- You move a rule between a skill, an instruction, `AGENTS.md`, or an agent definition.
- A dedupe deletes prose whose content may have no surviving home.

## Step 1 — Count prose occurrences per rule

For each consolidated rule, grep the tree for its distinctive phrase. Target: exactly one prose occurrence states the full rule; every other mention is a pointer that navigates to it.

```bash
grep -rn "KEY=VALUE output contract" .agents/skills .opencode/instructions AGENTS.md
# expect: 1 prose occurrence; remaining matches are pointers like "see <path>"
```

- A pointer is a link or an explicit `see <file>` reference. Pointers count as navigation and do not violate the single-prose rule.
- A second full restatement is a duplicate: delete it or replace it with a pointer.

## Step 2 — Resolve every pointer

For each pointer, open its target and confirm the target contains the moved rule.

- A pointer to a file whose rule has moved is broken navigation: repoint it or restore the rule.
- A pointer to a section heading: confirm the heading exists.

## Step 3 — Reject pure-pointer stubs in skills

A skill must be self-contained: it loads on a task trigger and never depends on reading an instruction. A skill file that is only a pointer to an instruction violates this.

- In a skill, inline the rule. Prefer the instruction → skill direction for references; skill → instruction is allowed only for instruction- or harness-authoring skills. Authoring detail: [building-modular-skills Rule 25](../../building-modular-skills/references/guidance-process.md).
- Pointers are fine when they point at authoring detail owned by another skill.

## Step 4 — Information-loss audit before deleting

Before deleting prose, list every fact, contract, or rule in the removed block and name the surviving home for each. Delete only when every item has a home; restore any item that does not.

Example — a justfiles consolidation removed three items with no replacement; the audit caught the loss and each was restored:

| Removed item | Surviving home (initial) | Outcome |
|---|---|---|
| `KEY=VALUE` output contract | none | restored |
| bash-over-Python doctrine | none | restored |
| state-management rules | none | restored |

Items with no surviving home are losses, not dedupe.

## Step 5 — Verify and record

- Re-run Step 1: confirm exactly one prose occurrence per rule and that every pointer resolves.
- Run the skill gates for a skills change: `just agent_utils::validate-skill <name>`.
- Record the Step 4 audit table in the change description.

## Red Flags

- A rule appears as prose in two files and neither is a pointer to the other.
- A pointer's target no longer contains the rule.
- A skill file contains only a pointer to an instruction.
- A dedupe has no information-loss table.
- "Moved" prose exists in neither the old nor the new home.
