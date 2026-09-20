---
id: cases/opencode/sdk_skills_injection
type: cases
L0: "SDK-spawned children get no skill auto-injection; read SKILL.md and prepend a task_skills block"
hotness: 0.9
ttl: 180d
version: 1
freshness: 2026-09-19
directory: cases/opencode
provenance: .opencode/plugins/helpers/workflow-subtask.ts
---
Failure: skills requested for an SDK-spawned child are not loaded automatically; the built-in task tool hooks (tool.definition / tool.execute.before) do not fire for plugin-spawned sessions.
Fix: validate the skill name, read .agents/skills/<name>/SKILL.md, and prepend a block of the form <task_skills> ... </task_skills> before the prompt text part.
evidence: .opencode/plugins/helpers/workflow-subtask.ts:116-157 (loadSkill/injectSkills/SKILL_NAME_PATTERN). Tests: .opencode/plugins/tests/helpers/workflow-subtask.test.ts:226-230, :422. Built-in comparison path: .opencode/plugins/skills-loader.ts:152.