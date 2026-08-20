# Full Tool Payloads Persisted in SQLite + Export

opencode.db (SQLite at ~/.local/share/opencode/opencode.db; tables session/message/part) stores part.data JSON: tool parts carry state.input (params) and state.output (results) verbatim, with a truncated flag (NOT truncated by default).

`opencode export <sessionID>` exports JSON {info, messages[]} with full tool input/output verbatim; `--sanitize` redacts them. Sessions live in SQLite — NOT per-session JSONL files (no storage/session dir).