---
id: cases/opencode/plugin_hot_reload_safe_development
type: cases
L0: "OpenCode v2 hot-reloads .opencode/plugins and instructions; develop in a staging dir outside loader roots, ship disabled, copy in last"
hotness: 0.85
ttl: 180d
version: 1
freshness: 2026-10-18
directory: cases/opencode
confidence: 0.9
status: active
provenance: operator-verified OpenCode v2 session 2026-10-18
---
# OpenCode plugin/instruction changes - safe development under v2 hot reload

Environment: OpenCode v2; harness files .opencode/plugins/ and .opencode/instructions/.

## Reload behavior changed in v2
- v2 hot-reloads .opencode/plugins/ and instruction files: editing them mid-session can reload the harness and break the agent's own loop (e.g., a newly active enforcement gate blocks the next tool call).
- v1 did NOT hot reload; it required a manual opencode restart.
- Superseded: memories stating "plugins load at server start; a change requires a restart" describe v1 and are OUTDATED for v2 (see mem:troubleshooting/opencode-plugin-live-diagnosis).

## Safe approach
1. Develop and validate in a staging dir OUTSIDE the loader scan roots. The loader scans only the root *.ts of .opencode/plugins (no recursion), so a sibling dir (.opencode/plugins-staging/) or /workspace/.tmp/ is safe.
2. Ship new behavior/enforcement DISABLED by default, so a reload cannot break the running agent.
3. Validate in staging by mirroring the repo deps + a scoped tsconfig, since the repo tsconfig/vitest only include .opencode/plugins/**.
4. Expect the activation copy itself to trigger a reload - copy the staged file into .opencode/plugins/ as the FINAL step.

Source: operator-verified OpenCode v2 session 2026-10-18.
Related: mem:cases/opencode/quality_gate_hang_blocks_edits, mem:claims/opencode/plugin_conventions.