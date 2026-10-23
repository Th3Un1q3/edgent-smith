---
id: cases/opencode/subtask_tail_process_local
type: cases
L0: "subtask_tail stores outputs in a per-process in-memory Map (24h TTL, 1000 ids), so cross-session re-reading is impossible; a validator judges pasted raw output instead"
hotness: 0.7
ttl: 180d
version: 1
freshness: 2026-10-22
directory: cases/opencode
provenance: "Observed RUG run 2026-10-22"
---
# subtask_tail evidence does not cross processes
Idea: `subtask_tail`'s store is a per-process in-memory `Map`, so another session or process cannot re-tail evidence; a validator must judge pasted raw output.
Scope: `helpers/subtask-tail.ts`; orchestrator evidence handoff.
Rationale: entries cap at 12 KB per output, 24h TTL, 1000 task ids, and live only in the process that recorded them. An empty array means "unknown id, expired, or different process", never "no output". Cross-session durability needs the kv-store; until then the orchestrator pastes `task_id` plus raw `outputText` into the validator prompt.
Source: observed RUG run 2026-10-22; `.opencode/plugins/helpers/subtask-tail.ts`; mem:cases/opencode/child_missing_plugin_tools