---
name: shaping
description: "Enforce modular-skill shaping budgets and audits. Use when editing any SKILL.md, workflow, or reference file."
applyTo: "{.agents/skills/**/SKILL.md,.agents/skills/**/workflows/**/*.md,.agents/skills/**/references/**/*.md,.agents/skills/**/recipes/**/*.md}"
---

# Shaping Gate

Skill shaping is owned by the `building-modular-skills` skill: budgets in `references/guidance-structure.md`, the audit command in `workflows/authoring-workflow.md`, and the completion gate in `workflows/shaping-checklist.md`. Load `SKILL.md` before editing a skill file.

Edit-time boundary: every file you create, rename, or add under a skill directory must be routed from that skill's root `SKILL.md` Task Routing Table in the same edit.
