# Reference: File Templates for Modular Skills

Copy-pasteable skeletons for every file in a shaped skill: the root `SKILL.md`, workflow files, and reference files. Fill in a skeleton, then validate the result against the [Shaping Checklist](../workflows/shaping-checklist.md).

When to load: when you need a starting skeleton for a skill file — copy it, fill it in, and wire the worked examples.

## Root SKILL.md Template

Copy this skeleton for the root index-and-router.
~~~~md
---
name: my-skill-name
description: >
  One-sentence summary of what this skill does, when to trigger, and what to exclude.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
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

## Completion Gate

**Completion Gate:** before you declare a skill complete, run the [Shaping Checklist](./workflows/shaping-checklist.md). One unchecked box means the skill is NOT complete.

## Task Routing Table

Every file appears here — the table is the completeness contract.

| I want to... | File |
|---|---|
| Create a new X | [workflows/create.md](./workflows/create.md) |
| Update an existing X | [workflows/update.md](./workflows/update.md) |
| Look up available options | [references/options.md](./references/options.md) |
| Compare approaches A vs B | [references/comparison.md](./references/comparison.md) |
| Run a recipe | [recipes/x.md](./recipes/x.md) |
| Run a script | [scripts/x.md](./scripts/x.md) |

## Related Skills

- `sibling-skill` — what it provides.
~~~~

**Implements: [guidance.md](../references/guidance.md) §1, §8, §12.** Keep the root under ~90 lines; list every file in the routing table; bump the version on every content change.

## Workflow File Template

Copy this skeleton for each workflow file under `workflows/`.
~~~~md
# Workflow: <Task Name>

Follow this workflow to [specific outcome].

When to load: [when this workflow applies].

## Prerequisites

- [Required reads or setup before starting]

## Steps

1. **Step one** — brief action and why.
2. **Step two** — brief action and why.
3. **Step three** — brief action and why.

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
~~~~

**Implements: [guidance.md](../references/guidance.md) §8, §6.** The root links this file; every numeric or behavioral rule in the steps carries an "Implements:" example.

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
// Implements: <rule it proves> — copy-pasteable worked example
```
~~~~

**Implements: [guidance.md](../references/guidance.md) §3, §6.** Define jargon once in the Vocabulary line; mark each example with "Implements:".
