# Reference: Root SKILL.md Template

Copy-pasteable skeleton for the root `SKILL.md`. The workflow and reference skeletons live in the sibling [templates-workflow-reference.md](./templates-workflow-reference.md); fill a skeleton in, then validate it against the [Shaping Checklist](../workflows/shaping-checklist.md).

When to load: when you need a starting skeleton for the root index-and-router — copy it and wire the worked examples.

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
compatibility: Universal  # or Requires OpenCode / Requires DSH / Requires GitHub Copilot — name only the harnesses actually used
# Universal only when no file contains harness-specific content; else `Requires <canonical harness>` (anti-patterns.md section 11)
metadata:
  version: "1.0.0"
  delta: "what changed and why; author-process history lives here, never in body prose"
  author: <author>
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
