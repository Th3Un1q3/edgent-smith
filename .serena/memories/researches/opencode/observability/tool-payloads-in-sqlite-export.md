# Full Tool Payloads Persisted in SQLite + Export

opencode.db (SQLite at ~/.local/share/opencode/opencode.db; tables session/message/part) stores part.data JSON: tool parts carry state.input (params) and state.output (results) verbatim, with a truncated flag (NOT truncated by default).

`opencode export <sessionID>` exports JSON {info, messages[]} with full tool input/output verbatim; `--sanitize` redacts them. Sessions live in SQLite — NOT per-session JSONL files (no storage/session dir).

## MCP tool attribution (appended 2026-10-23)

**Name-only attribution.** MCP-sourced calls are distinguishable from native tools only by the flattened `<server>_<tool>` string in `part.data.tool`. Observed names and counts (`part` group-by on `json_extract(data,'$.tool')`): `gateway_mcp-exec` 6300, `gateway_mcp-find` 1441, `gateway_code-mode` 1125, plus `the_mcp_*` and `codegraph_*`. No server/provider field exists in the part; `state.metadata` for a `gateway_code-mode` part was `{truncated:false}` only. The wrapper path dominates (6300 exec vs 1125 code-mode), i.e. historical traffic ran through per-call exec wrappers rather than one sandbox script.

**Plugin hook surface.** `context.tool.hook('execute.before'|'execute.after')` events expose only `event.tool`, `event.input`, `event.sessionID`, `event.status` (`.opencode/plugins/quality-gate-enforcer.ts:83,90`; `.opencode/plugins/tool-limit-reminder.ts:344-348`). Tool registration uses `context.tool.transform` (`.opencode/plugins/workflow.ts:306`, `.opencode/plugins/goal-continuation.ts:273`). Hooks match tool-name strings, so they observe MCP calls but cannot attribute them to a server.

**Repo-side mirror.** `.opencode/plugins/sessions/<sessionID>.json` records only `startedAt`, `agent`, `lastMessageSentAt`, `toolCalls{<name>: <lastTimestamp>}`, `cancelledAt`, `idleAt` (writer `.opencode/plugins/helpers/kv-store.ts:4,24`) — per-name last-call timestamp, no counts, inputs, durations, or server.

**Gaps.** No per-MCP-tool token or cost data — cost and tokens are per assistant message (`message` table columns `cost`, `tokens`, `modelID`, `providerID`); no structural server attribution; no latency aggregation (only per-part `state.time.start/end`); inner calls executed inside one `gateway_code-mode` script are invisible, because the whole script is a single part.

See `docs/plan/2026-10-23-mcp-code-mode-optimization/before-after-proposal.md`; decision: `architecture/adr/ADR-013-native-code-mode-mcp-access`.
