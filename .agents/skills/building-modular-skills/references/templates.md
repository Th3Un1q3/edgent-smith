# Reference: File Templates for Modular Skills

Copy-pasteable skeletons for every file in a shaped skill: the root `SKILL.md`, workflow files, and reference files. Fill in a skeleton, then validate the result against the [Shaping Checklist](../workflows/shaping-checklist.md).

When to load: when you need a starting skeleton for a skill file — copy it, fill it in, and wire the worked examples.

## Root SKILL.md Template

Copy this skeleton for the root index-and-router.
~~~~md
---
name: my-skill-name
description: >
  User-invoked skill: one-line human-facing summary of what this skill does.
  Model-invoked skill: trigger-rich description that names the failure it fixes
  and the user phrases that should fire it (Rules 17-18).
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  delta: "what changed and why; author-process history lives here, never in body prose"
  author: GitHub Copilot
---

# My Skill Name

One-paragraph overview — what the skill is for and what it produces.

## When to Use This Skill

Invoke this skill when:
- Specific user intent 1
- Specific user intent 2

## When Not to Use This Skill

Do not use this skill for:
- Related but out-of-scope task 1
- Broad unrelated task 2

## Principles

- **Active-verb kicker:** one-line rule with a pointer to the file that carries the detail.

## Task Routing Table

Every file appears here; pick the row that matches your task.

| I want to... | File |
|---|---|
| Create a new X | [workflows/create.md](./workflows/create.md) |
| Update an existing X | [workflows/update.md](./workflows/update.md) |
| Look up available options | [references/options.md](./references/options.md) |
| Compare approaches A vs B | [references/comparison.md](./references/comparison.md) |
| Run a recipe | [recipes/x.md](./recipes/x.md) |
| Run a script | [scripts/x.md](./scripts/x.md) |

Domain helpers live under per-skill `scripts/`; shared `audit_fences.py`/`validate_md_links.py` are not scaffolded — reference `agent_utils/scripts/` per Rule 24.

## Related Skills

- `sibling-skill` — what it provides.
~~~~

The root carries no author-process section; author-process records (version, delta) live in frontmatter `metadata.delta` (Rule 14).

**Root leanness, routing completeness, versioning: Rules 1, 8, 12. Description dialect and failure-mode naming: Rules 17-18.**

## Workflow File Template

Copy this skeleton for each workflow file under `workflows/`.
~~~~md
# Workflow: <Task Name>

Follow this workflow to [specific outcome].

When to load: [when this workflow applies].

## Prerequisites

- [Required reads or setup before starting]

## Steps

1. **Step one** — brief action and why. Done when: [observable completion signal].
2. **Step two** — brief action and why. Done when: [observable completion signal].
3. **Step three** — brief action and why. Done when: [observable completion signal].

Gate: [hard stop — no [x], no next step] (Rule 20).

## Examples

```language
// concrete example
```

## Clarification Triggers

Ask the user before proceeding if:
- [Ambiguous condition 1]
- [Ambiguous condition 2]

## Acceptance Criteria

- [Measurable check 1]
- [Measurable check 2]
- It's working if: [observable signal that the outcome holds]
~~~~

**Fence validity:** See Rule 15. **No meta-commentary:** See Rule 14. **Completion criteria:** See Rule 20.

The root links this file; place a copy-pasteable example adjacent to every numeric or behavioral rule in the steps.

## Reference File Template

Copy this skeleton for each reference file under `references/`.
~~~~md
# Reference: <Topic>

Canonical details for [topic]; recipes point here instead of re-defining the facts.

When to load: [when to open this reference].

## Vocabulary

- **term:** one-line definition of a load-bearing term.

## Options / API Surface

| Option | Type | Default | Description |
|---|---|---|---|
| `option_a` | `string` | `"default"` | What it controls |
| `option_b` | `boolean` | `false` | What it enables |

## Examples

```javascript
console.log(option_a);
```
~~~~

Define jargon once in the Vocabulary line; place a copy-pasteable example adjacent to each rule. Keep each section to one idea; split a reference past ~250 lines into a sibling file (Rule 19).
