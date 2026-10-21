---
id: preferences/rug_resume_skills_once
type: preferences
L0: "Resume via task_id may pass skills the child lacks but must never repeat a skill it already received; session reuse prepends a duplicate <task_skills> block."
hotness: 0.8
ttl: 90d
version: 2
freshness: 2026-10-21
directory: preferences
provenance: .opencode/plugins/helpers/workflow-subtask.ts; .opencode/agents/rug.md
---
# Chained resume: add new skills, never repeat delivered ones

Rule (2026-10-21, corrected): a chained prompt (resume via task_id) MAY pass skills the child has not already received - a later phase may need a capability the first phase did not - but must NEVER repeat a skill that child already got.

Mechanism: .opencode/plugins/helpers/workflow-subtask.ts reuses the session for task_id (lines 723-724) and prepends a <task_skills> block whenever skills is non-empty (lines 941-943, injectSkills 293-313); nothing is replaced, so a repeat duplicates the block beside the copy already in context.

Operationally the orchestrator must track which skills each child received beside its id, so a resume adds only the new ones. An automatic interruption recovery in the shared run helper passes no skills because it continues the same work.

Applied in .opencode/agents/rug.md: rule at the execution-envelope section, table resume row points at it, helper resume call carries no skills.

Supersedes the earlier version of this memory, which said to omit skills on resume. That absolute wording (pass only on the first call / omit on resume) is wrong and must not be reintroduced.

Source: .opencode/plugins/helpers/workflow-subtask.ts:723-724,293-313,941-943; .opencode/agents/rug.md execution-envelope section.