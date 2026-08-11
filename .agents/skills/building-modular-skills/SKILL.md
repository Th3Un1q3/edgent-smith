---
name: building-modular-skills
description: >
  Author reusable, focused skills using a multi-file layout: a root SKILL.md index
  with applicability and routing, workflow files for step-by-step guidance, and
  reference files for API, executables or spec details. Shaping splits a skill into these routed
  files plus a completion gate; run the gate before declaring any skill complete.
  Trigger on "author a skill", "split a skill into files", "skill structure",
  "write a workflow or reference file", or requests to make a skill easier to
  maintain and compose. Not for general code design, non-skill documentation, or
  single-bug fixes outside SKILL.md authoring.
license: MIT
compatibility: Universal
metadata:
  version: "3.1.0"
  delta: "3.1.0 — guidance.md rewritten to rule-based guidance; context-gathering case study removed; prompt-qa findings addressed"
  author: Th3Un1qu3
---

# Building Modular Skills

A skill is a folder of Markdown files that teaches an assistant to do one thing well. Shaping splits a skill into routed files — a root `SKILL.md` index and router, workflow files under `workflows/`, reference files under `references/`, recipe files under `recipes/`, and script files under `scripts/` — plus a completion gate that must pass before you declare the skill done. This layout keeps the root short and scannable, prevents loading detail the task does not need, and makes each file easy to update or reuse across skills. Audit new skills against the canonical exemplar: `context-gathering`.

## When to Use This Skill

Invoke this skill when:
- You are creating or refining a custom skill for a workspace.
- You are writing a `SKILL.md` — metadata, applicability, or routing.
- You are turning a multi-step workflow into a reusable skill definition.
- You want a pattern that keeps skills easy to maintain and compose.

## When Not to Use This Skill

Do not use this skill for:
- General code design or application architecture that is not about skills.
- Writing non-skill documentation — READMEs, tests, or source comments.
- Fixing a single code bug unrelated to `SKILL.md` authoring.

## Principles

- **Keep the root lean:** hold metadata, triggers, a workflow skeleton, cross-cutting principles, and routing in SKILL.md; push instance detail to references. Layout rules: [workflows/authoring-workflow.md](./workflows/authoring-workflow.md).
- **Route every file:** list every file — workflows, references, recipes, scripts, and templates — in the routing table; an unrouted file is dead weight.
- **Define jargon once:** collect load-bearing terms in a Vocabulary line in the relevant reference; keep factual tool names. Pattern: [references/guidance.md](./references/guidance.md).
- **Give every rule a worked example:** wire each numeric or behavioral rule to a copy-pasteable example marked "Implements:". Patterns: [references/templates.md](./references/templates.md).
- **Verify every link and anchor:** after edits, resolve every cross-reference; grep the whole tree for stale naming. Protocol: [references/guidance.md](./references/guidance.md).
- **State invariants generically:** put cross-cutting principles in the root; apply them per instance in recipes; never scope a general rule to one store type.
- **Bump the version on every content change:** record what changed and why.
- **Practice what you preach:** before declaring a skill complete, run the [Shaping Checklist](./workflows/shaping-checklist.md) — an unchecked box means the skill is NOT complete.

## Completion Gate

**Completion Gate:** before you declare a skill complete, run the [Shaping Checklist](./workflows/shaping-checklist.md). One unchecked box means the skill is NOT complete. The checklist applies to this skill too.

## Task Routing Table

Every file appears here — the table is the completeness contract.

| I want to... | File |
|---|---|
| Author or rework a skill | [workflows/authoring-workflow.md](./workflows/authoring-workflow.md) |
| Validate a skill against the completion gate | [workflows/shaping-checklist.md](./workflows/shaping-checklist.md) |
| Need the rules, Vocabulary line, or the guidance behind the checks | [references/guidance.md](./references/guidance.md) |
| Need copy-pasteable file templates | [references/templates.md](./references/templates.md) |

## Related Skills

- `context-gathering` — canonical exemplar of a shaped skill; audit new skills against its structure.
- `skill-creator` — benchmarking and grading of skills.
