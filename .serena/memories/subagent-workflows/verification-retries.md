# Verification & Retry Discipline

**Use when:** a subagent reports completion, returns empty/status-line, or scope changes mid-session.

## Pitfalls

- Trusting self-reported "done" → incomplete work shipped.
- Re-running the same large prompt after failure → same truncation.
- Treating empty returns as "nothing to do".
- Stale todo list → the harness can suspend tools until todowrite is called.

## Rules

1. Never trust self-reported "done": launch a separate read-only validation subagent that re-reads the actual files against the acceptance criteria.
2. Retry ladder: resume once via session id; if it returns a status line again, split into tiny atomic pieces and re-run; never re-run the same large prompt more than once.
3. Treat empty/status-line returns as "incomplete" — the artifact is missing; re-run atomically.
4. Keep the todo list current: create it before launching anything, update in real time, add items the moment scope changes.