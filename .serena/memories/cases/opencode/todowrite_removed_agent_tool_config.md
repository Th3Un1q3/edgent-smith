---
id: cases/opencode/todowrite_removed_agent_tool_config
type: cases
L0: "OpenCode v2 removed the built-in todowrite tool; agents must stop calling it and reach plugin/MCP tools via Code Mode (permission execute:allow)"
hotness: 0.8
ttl: 180d
freshness: 2026-10-06
directory: cases/opencode
provenance: session opencode-plugin-v2 tool-availability fix
version: 1
---
# OpenCode v2 removed todowrite; fix agent tool availability

Environment: OpenCode v2.0.23 (binary /home/vscode/.opencode/bin/opencode).

Failure: RUG agents declared todowrite in frontmatter and told the model to call it; the model got 'No tool named todowrite is currently available'.

Cause: V2 removed the built-in todo tool. The runtime migration shim lists todowrite among the removed tools: "The todowrite tool is no longer available and must not be called." No V2 todo tool exists (searching the binary finds only Bun's test.todo plus that removal list).
Second cause: plugin/MCP tools (e.g. the workflow tool) are reached through Code Mode (execute -> tools.<name>); an agent that denies execute cannot call them even when the tool itself is permitted.

Fix:
- Remove every todowrite reference (agent frontmatter permission maps AND prompt text AND skills). Progress now comes from the workflow tool's server-side toasts and the envelope steps[]/stats.
- Add execute: allow to the orchestrator agent so Code Mode (and therefore plugin tools) is reachable.
- V2 agent config uses permissions (rules list {action,resource,effect}); legacy permission/tools/bash/task are auto-migrated, but new config should use V2 names (shell/subagent/plugins).

Verify: opencode debug agents (no todowrite rules; execute+workflow allowed) and opencode debug config (V1 permission auto-converted to V2 permissions).
Evidence: binary migration shim (todowrite removal list); .opencode/agents/rug-workflow.md, rug.md, rug-swe.md; .agents/skills/task-delegation/SKILL.md.