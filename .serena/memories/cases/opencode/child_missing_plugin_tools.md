---
id: cases/opencode/child_missing_plugin_tools
type: cases
L0: "Subtask children do not receive plugin custom tools (subtask_run, subtask_ls, subtask_tail); validators cannot probe, so the orchestrator runs the probe and hands over raw ids and output"
hotness: 0.7
ttl: 180d
version: 1
freshness: 2026-10-22
directory: cases/opencode
provenance: "Observed RUG run 2026-10-22"
---
# Child sessions cannot call plugin tools
Idea: A subtask child session does not receive the plugin's custom tools — `subtask_run`, `subtask_ls`, `subtask_tail` — so a validator child cannot run a live probe. The orchestrator runs the probe and hands the child raw output with ids.
Scope: validator prompts in `.opencode/agents/rug.md`; the child agent `rug-swe` denies `subtask_*` and `workflow` by design as a recursion guard.
Rationale: tool registration is not tool exposure. A prompt telling a child to verify "with your own tool calls" is unexecutable, and an obedient child returns FAIL for unrun evidence. Split the roles: the producer runs the probe, the validator judges the quoted raw output and ids; unrun evidence is INCONCLUSIVE for the validator, not a work FAIL.
Source: observed RUG run 2026-10-22; `.opencode/agents/rug-swe.md` permission block; `.opencode/plugins/workflow.ts`; mem:cases/opencode/plugin_ctx_session_fork