---
id: troubleshooting/session-review/corrupted_session_recovery
L0: "Procedure to recover a lost or corrupted OpenCode session: locate via prompt-history.jsonl, confirm missing rows in opencode.db, harvest residual tool-output and logs, then reconstruct where it stopped"
hotness: 0.6
ttl: 180d
version: 1
freshness: 2026-09-21
directory: troubleshooting/session-review
provenance: operator-verified live session 2026-09-21
---
# Corrupted session recovery

## Steps
1. Identify the target session by matching a distinctive fragment of a known prompt against ~/.local/state/opencode/prompt-history.jsonl (line order excludes the current session).
2. Confirm corruption via read-only SQLite at ~/.local/share/opencode/opencode.db: rows missing from session/message/part/event/todo for that id, plus errors like Failed query: insert into part / message.
3. Recover residual activity from ~/.local/share/opencode/tool-output/* and log/opencode.log (mtimes keyed to the run window), and from surviving child-session exports.
4. Reconstruct where it stopped and what is left from tool-call sequences and any todo snapshots.

## Caveats
- If the rows never persisted, the transcript is unrecoverable except by reconstruction.
- A long persistence gap (hours) can exist while the process runs; absence of rows does not imply the session id is wrong.

Source: operator-verified live session 2026-09-21.