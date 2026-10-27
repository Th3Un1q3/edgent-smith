---
name: skill-rule-contradiction-audit-2026-10-25
id: lessons/skill-rule-contradiction-audit-2026-10-25
description: Pointer to the enforceable home of the skill-rule contradiction audit, .opencode/instructions/skill-editing.instructions.md; a memory is not injected at edit time, so the method is not kept here.
scope: experiences
type: experiences
status: superseded
superseded-by: .opencode/instructions/skill-editing.instructions.md
confidence: high
timestamp: 2026-10-25
freshness: 2026-10-25
ttl: 180d
L0: "Retired pointer — the skill-rule contradiction audit lives in .opencode/instructions/skill-editing.instructions.md, which loads on .agents/skills/** and .opencode/agents/*.md edits; a memory is not injected at edit time."
tags: [skills, audit, contradictions, harness, validation]
sources:
  - .agents/skills/building-modular-skills/SKILL.md
  - .agents/skills/task-delegation/SKILL.md
  - mem:audit/fresh-reader-findings-task-delegation-building-modular-skills
  - mem:lessons/orchestration/verify-tool-names
provenance: 120-statement audit of .agents/skills, 2026-10-25; findings are paired rules, not session narrative.
---

# Skill rule contradiction audit

The rule: a skill edit ends with a contradiction sweep (pair the normative statements that govern one behaviour, restate one when the pair cannot both hold) and a dead-name check (every tool, command, path, and config key the edit names resolves in the tree).

It lives in `.opencode/instructions/skill-editing.instructions.md`, which loads on `.agents/skills/**` and `.opencode/agents/*.md` edits.

Why it is not a memory: a memory is read only when an agent decides to recall it, so it is absent at the moment of the edit. The instruction is injected by path, the only home that can hold an edit-time rule.

The sweep steps, its scope, and the failure classes are in the instruction. This memory carries the pointer and nothing else.
