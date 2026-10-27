---
id: entities/opencode-plugin/rug_workflow_agent
type: entities
L0: "rug-workflow RUG orchestrator (card deleted 2026-10-26); historical record only. The workflow tool is retired (ADR-012): the plugin registers subtask_ls/run/tail, and plugins.workflow gates task-delegation instruction injection."
hotness: 0.2
ttl: 90d
version: 4
freshness: 2026-10-26
directory: entities/opencode-plugin
provenance: operator-verified live session 2026-09-21; removal verified against the tree 2026-10-26; destination, tool retirement, and permission state re-verified from the tree 2026-10-26
claim_ids: [claims/opencode/sdk_subagent_spawn]
---
# rug-workflow agent

**Removed 2026-10-26.** The card was deleted from `.opencode/agents/` (uncommitted working-tree change), so nothing below is live guidance.

## Where the workflow function lives now

The `workflow` tool is retired. `.opencode/plugins/workflow.ts:190` states it:

```ts
// ADR-012: workflow tool retired. Standalone trio (subtask_ls, subtask_run,
// subtask_tail) is the only execution surface; no script wrapper remains.
```

The plugin's `context.tool.transform` block registers exactly three tools — `SUBTASK_LS_TOOL_NAME`, `SUBTASK_RUN_TOOL_NAME`, `SUBTASK_TAIL_TOOL_NAME` (declared at `workflow.ts:32-34`, added at `:308`, `:324`, `:359`) — and no `workflow` tool. `docs/workflow-tool.md` opens with "**Retired:** `tools.workflow` is retired. This page is legacy-only reference."

`plugins.workflow` in `.opencode/plugins/config/harness.config.ts:77` survives as an instruction-injection gate, not a tool:

```ts
const workflowPlugin: { instructions: string, agents: string[] } = {
  instructions: '.agents/skills/task-delegation/SKILL.md',
  agents: ['rug'],
}
```

The comment above it calls `agents` "the sole gate for workflow instruction injection; tool exposure is diagnostic only". So `agents: ['rug']` injects `.agents/skills/task-delegation/SKILL.md` into `rug` sessions as `<workflow_instructions>` and grants no tool.

## Resolved: the `workflow` permission grant

`rug.md` carried `"workflow": "allow"` — a grant for a tool nothing registers, and the leftover of the staged index copy this memory previously recorded as over-granting against its working-tree counterpart. Removed from the card on 2026-10-26. The permission block is now `"*": "deny"` with `goal`, `subtask_*`, `execute`, `question`, and the body lists exactly the six tools the agent holds — `goal`, `execute`, `subtask_run`, `subtask_ls`, `subtask_tail`, `question` — so frontmatter and body agree.

## History

The card superseded `rug-debug.md` (deleted). Its permissions were star deny plus workflow/todowrite/question allow — no task, no skill, no read. The goal-continuation orchestrator allowlist (`ALLOWED_ORCHESTRATORS` at `.opencode/plugins/goal-continuation.ts:34`) is `new Set(['rug', 'rug-team-coach'])`.

Skill selection was delegated to the FIRST in-script subtask with structured output, which returned a step-to-skills map fed into later `subtask({skills})` calls.

## Correctness rules (historical)

- Memory search is a pre-design phase, not a `steps[]` entry.
- Call workflow once per PHASE (not per goal, not per subtask).
- Read the envelope status/stats/steps[]; step status is the real signal.
- Validation is always a fresh-session subtask.
- Agent changes: OpenCode v2 hot-reloads automatically; no manual restart required.

Source: operator-verified live session 2026-09-21; destination, tool retirement, and permission state re-verified on 2026-10-26 against `.opencode/plugins/workflow.ts:32-34,190-192,308,324,359`, `.opencode/plugins/config/harness.config.ts:73-91`, `docs/workflow-tool.md`, `.opencode/agents/rug.md`, and `.opencode/plugins/goal-continuation.ts:34`. See mem:claims/opencode/sdk_subagent_spawn, mem:cases/opencode/workflow_producer_unverified_tree, mem:architecture/adr/ADR-003-tag-delimited-structured-output.
