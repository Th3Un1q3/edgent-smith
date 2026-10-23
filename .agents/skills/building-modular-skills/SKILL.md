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
  version: "4.0.2"
  delta: "4.0.2 — author a skill, then route every workflow and reference file from the root index and run the completion gate before declaring it done."
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
- **Define jargon once:** collect load-bearing terms in a Vocabulary line in the relevant reference; keep factual tool names. Pattern: [references/guidance-structure.md](./references/guidance-structure.md).
- **Give every rule an adjacent worked example:** place a copy-pasteable example next to each numeric or behavioral rule; optional labels never break code fences.
- **Write for the reader:** every body sentence and example teaches the skill's subject; no meta-commentary or author-process sections in the reader path — author-process history lives in frontmatter metadata. Rules: [references/guidance-content.md](./references/guidance-content.md) Rule 14.
- **Verify every link and anchor:** after edits, resolve every cross-reference; grep the whole tree for stale naming. Protocol: [references/guidance-process.md](./references/guidance-process.md).
- **State invariants generically:** put cross-cutting principles in the root; apply them per instance in recipes; never scope a general rule to one store type.
- **Fix a named failure mode:** a skill exists to fix an agent failure mode, not to cover a topic; name the failure in the description. Rules: [references/guidance-process.md](./references/guidance-process.md) Rule 17.
- **Bump the version on every content change:** record what changed and why.
- **State the outcome, then a generic fallback:** phrase a gate or technique as the outcome it must produce, then the fallback for an environment without the needed capability; name a specific realization only when the repo verifies it. Never assert which environments support the skill; see [references/divergence-and-gates.md](./references/divergence-and-gates.md).
- **Diverge, then gate:** draft at least two candidate shapes before writing the final tree; then run a blind critique and a machine gate, using the fallback where the environment cannot spawn a separate reviewer or run a shell. Prevents the author grading its own first idea; protocol: [references/divergence-and-gates.md](./references/divergence-and-gates.md).
- **Keep skills self-contained:** a skill loads on a task trigger and never depends on reading an instruction file — inline what it needs; only instruction- or harness-authoring skills may point at them. Rule: [references/guidance-process.md](./references/guidance-process.md).
- **Practice what you preach:** before declaring a skill complete, run the [Shaping Checklist](./workflows/shaping-checklist.md) — an unchecked box means the skill is NOT complete.

## Task Routing Table

Every file in the skill tree appears here; pick the row that matches your task.

| I want to... | File |
|---|---|
| Author or rework a skill | [workflows/authoring-workflow.md](./workflows/authoring-workflow.md) |
| Validate a skill against the completion gate | [workflows/shaping-checklist.md](./workflows/shaping-checklist.md) |
| Need the structural rules — root leanness, routing, disclosure | [references/guidance-structure.md](./references/guidance-structure.md) |
| Need the content rules — jargon, writing style, examples, framing | [references/guidance-content.md](./references/guidance-content.md) |
| Need the process rules, the anti-patterns pointer, or the worked example | [references/guidance-process.md](./references/guidance-process.md) |
| Avoid the 11 failure patterns skills fall into | [references/anti-patterns.md](./references/anti-patterns.md) |
| Force divergence, run a blind critique, and gate on an exit code | [references/divergence-and-gates.md](./references/divergence-and-gates.md) |
| Record portability evidence for environment-neutral claims | [references/portability-checklist.md](./references/portability-checklist.md) |
| Need copy-pasteable file templates | [references/templates-root.md](./references/templates-root.md) |
| Need a workflow or reference file skeleton | [references/templates-workflow-reference.md](./references/templates-workflow-reference.md) |

Shared audit tooling lives in `agent_utils/scripts/` — `audit_fences.py` and `validate_md_links.py` — as single source per Rule 24. Do not copy into per-skill `scripts/` (Rule 8 exception).

## Related Skills

- `context-gathering` — canonical exemplar of a shaped skill; audit new skills against its structure.
- `harness-management` — decides where a change belongs (placement/routing); this skill owns how to shape the chosen artifact.
- `skill-creator` — benchmarking and grading of skills.
