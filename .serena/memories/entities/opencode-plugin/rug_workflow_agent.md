---
id: entities/opencode-plugin/rug_workflow_agent
type: entities
L0: "rug-workflow primary agent (.opencode/agents/rug-workflow.md) supersedes rug-debug.md; a RUG orchestrator whose only execution channel is the workflow tool, with skill selection delegated to an in-script subtask"
hotness: 0.8
ttl: 90d
version: 1
freshness: 2026-09-21
directory: entities/opencode-plugin
provenance: operator-verified live session 2026-09-21
claim_ids: [claims/opencode/sdk_subagent_spawn]
---
# rug-workflow agent

The rug-workflow primary agent (.opencode/agents/rug-workflow.md) supersedes rug-debug.md (deleted).

## Permissions
It is a RUG orchestrator whose ONLY execution channel is the workflow tool: permissions star deny plus workflow/todowrite/question allow (no task, no skill, no read).

## Skill selection
Delegated to the FIRST in-script subtask with structured output, which returns a step-to-skills map fed into later subtask({skills}) calls.

## Correctness rules
- Memory search is a pre-design phase, not a steps[] entry.
- Call workflow once per PHASE (not per goal, not per subtask).
- Read the envelope status/stats/steps[]; step status is the real signal.
- Validation is always a fresh-session subtask.
- Agents load only at server restart.

Source: operator-verified live session 2026-09-21. See claims/opencode/sdk_subagent_spawn, cases/opencode/workflow_producer_unverified_tree, architecture/adr/ADR-003-tag-delimited-structured-output.