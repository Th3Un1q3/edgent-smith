---
name: building-modular-skills
description: >
  Author reusable, focused skills using a multi-file layout: a root SKILL.md index
  with applicability and routing, workflow files for step-by-step guidance, and
  reference files for API, executables or spec details. Shaping fixes the sprawl
  failure mode: an unshaped skill grows into one unreadable document that buries
  the actionable step. Shaping splits a skill into these routed
  files plus a completion gate; run the gate before declaring any skill complete.
  Trigger on "author a skill", "split a skill into files", "skill structure",
  "write a workflow or reference file", or requests to make a skill easier to
  maintain and compose. Not for general code design, non-skill documentation, or
  single-bug fixes outside SKILL.md authoring.
license: MIT
compatibility: Universal
metadata:
  version: "3.5.0"
  delta: |
    3.5.0 (audit-consistency pass): Rule 14 audit narrowed to target author-process machinery (## Completion Gate and ## Source anchors headings, marker strings) with a documented concept-usage exception; Rule 15 fence audit moved to scripts/audit_fences.py; check 21 exempts structural "When Not to Use" sections and quoted reframe examples.
    3.5.0 — research applied (mattpocock/skills): rules 17-24 added (failure-mode-driven design, description dialects, progressive disclosure with reference budgets, executable instructions with completion criteria, positive prompting with no-op pruning, explicit skill-tool composition, never-invent verification, single source of truth); references/anti-patterns.md maps 9 anti-patterns to preventing rules; Rule 14 audit extended with "the table is the completeness contract"; fence audit covers ~~~~ fences; writing-style pointers pinned to the canonical .opencode copy; root reader-path prose stripped of readership and design commentary — this meta-skill's gate-exception rationale moved here; 16:16 → 24:24.
    3.4.0 — added scripts/validate_md_links.py: cross-skill Markdown link validator
    3.3.0 — compacted prose: dropped mapping table, checklist now points to rules, collapsed vocabulary
    3.2.0 — reader-benefit hardening: rules 14-16 added (reader-benefit, fence validity, examples match facts); check 6 amended to positional wiring; Completion Gate removed from the root template; 13→16 counts updated; author-process records confined to frontmatter metadata.
  author: Th3Un1qu3
---

# Building Modular Skills

A skill is a folder of Markdown files that teaches an assistant to do one thing well. Shaping splits a skill into routed files — a root `SKILL.md` index and router, workflow files under `workflows/`, reference files under `references/`, recipe files under `recipes/`, and script files under `scripts/` — plus a completion gate that must pass before you declare the skill done. A lean root loads on every trigger; workflows and references load only on match. Push too little detail down and the top bloats; push too much and you hide material the agent needs — sprawl is the failure mode. Audit new skills against the canonical exemplar: `context-gathering`.

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
- **Give every rule an adjacent worked example:** place a copy-pasteable example next to each numeric or behavioral rule; optional labels never break code fences.
- **Write for the reader:** every body sentence and example teaches the skill's subject; no meta-commentary or author-process sections in the reader path — author-process history lives in frontmatter metadata. Rules: [references/guidance.md](./references/guidance.md) Rule 14.
- **Verify every link and anchor:** after edits, resolve every cross-reference; grep the whole tree for stale naming. Protocol: [references/guidance.md](./references/guidance.md).
- **State invariants generically:** put cross-cutting principles in the root; apply them per instance in recipes; never scope a general rule to one store type.
- **Fix a named failure mode:** a skill exists to fix an agent failure mode, not to cover a topic; name the failure in the description. Rules: [references/guidance.md](./references/guidance.md) Rule 17.
- **Bump the version on every content change:** record what changed and why.
- **Practice what you preach:** before declaring a skill complete, run the [Shaping Checklist](./workflows/shaping-checklist.md) — an unchecked box means the skill is NOT complete.

## Task Routing Table

Every file in the skill tree appears here; pick the row that matches your task.

| I want to... | File |
|---|---|
| Author or rework a skill | [workflows/authoring-workflow.md](./workflows/authoring-workflow.md) |
| Validate a skill against the completion gate | [workflows/shaping-checklist.md](./workflows/shaping-checklist.md) |
| Need the rules, Vocabulary line, or the guidance behind the checks | [references/guidance.md](./references/guidance.md) |
| Avoid the 9 failure patterns skills fall into | [references/anti-patterns.md](./references/anti-patterns.md) |
| Need copy-pasteable file templates | [references/templates.md](./references/templates.md) |
| Validate Markdown links across a skills tree | [scripts/validate_md_links.py](./scripts/validate_md_links.py) |
| Audit code fences in a skill tree | [scripts/audit_fences.py](./scripts/audit_fences.py) |

## Related Skills

- `context-gathering` — canonical exemplar of a shaped skill; audit new skills against its structure.
- `skill-creator` — benchmarking and grading of skills.