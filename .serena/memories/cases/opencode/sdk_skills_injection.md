---
id: cases/opencode/sdk_skills_injection
type: cases
status: superseded
L0: "Superseded 2026-11-26: prompt skill attachments ({id}) rendered by the host replace the SKILL.md read-and-prepend fix."
hotness: 0.9
ttl: 180d
version: 2
freshness: 2026-11-26
directory: cases/opencode
provenance: .opencode/plugins/helpers/workflow-subtask.ts (removed 2026-11-26)
---
> **Superseded 2026-11-26** by `mem:decisions/opencode-native-skill-injection-subtask-run`: the SDK prompt input carries skill attachments (`{ skills: [{ id }] }`), and the host renders `<skill_content name="…">` for each in input order with no dedupe. The failure, fix and evidence below describe the 2026-09-19 tree.

Failure: skills requested for an SDK-spawned child were not loaded automatically; the built-in task tool hooks (tool.definition / tool.execute.before) did not fire for plugin-spawned sessions.

Fix at the time: validate the skill name, read .agents/skills/<name>/SKILL.md, and prepend a block of the form <task_skills> ... </task_skills> before the prompt text part.

evidence (paths as written on 2026-09-19; the helper module is gone from the 2026-11-26 tree): .opencode/plugins/helpers/workflow-subtask.ts:116-157 (loadSkill/injectSkills/SKILL_NAME_PATTERN). Tests: .opencode/plugins/tests/helpers/workflow-subtask.test.ts:226-230, :422. Built-in comparison path: .opencode/plugins/skills-loader.ts:152.