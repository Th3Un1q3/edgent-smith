---
id: projects/opencode-workflows/workflow-tool/live-progress-and-sessions
type: entities
L0: "No live progress: subtask_run returns on settle with no toast and no run id; inspect via subtask_ls, subtask_outputs or the session. Children are real sessions: parentID on create, server-side linkage on fork; session list shows top-level sessions only."
freshness: 2026-11-24
directory: projects/opencode-workflows/workflow-tool
ttl: 180d
provenance: docs/workflow-tool.md § Live progress (ll. 150-158), § subtask_ls (l. 133), § Inspecting subsessions (ll. 202-204)
---
# Live progress and child sessions

## No live progress
The plugin reports no live progress. `subtask_run` returns when the child settles, and its call path wires no toast sink, so no toast fires and no session title carries a run id. Inspect a running child with `subtask_ls`, read its output with `subtask_outputs`, or open the session.

## Child sessions are real sessions
A child is a normal session, so the session switcher shows it, and it can be opened directly or resumed with `opencode run --session <id>`. `opencode session list` prints top-level sessions only, so a child is reached by the id a run printed, not from that list.

- A normal subtask sets `parentID` to the calling session when it creates the child.
- A forked subtask is created through `session.fork`, and its parent linkage is established server-side rather than by the plugin. A fork is not a `parentID` child, so `subtask_ls` does not list it; keep the `task_id` the fork returned.

The inline nested subagent view under the tool call is unavailable to a plugin tool: this opencode version hard-gates that view to the built-in `task` tool, so a plugin tool cannot render it. Open the child from the session switcher or by id instead.

## Result titles
Each tool call titles its own result: `subtask_run: <status>`, `subtask_ls: <n> subtask(s)`, and `subtask_outputs: <n> output(s)`.

## Title
A newly created child keeps the `description` it was created with, truncated to 80 characters, with no run-id prefix and no lifecycle marker. The runtime never rewrites a title and sets none on a fork; fork provenance appears only in the result's `forked_from`.
