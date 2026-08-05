# Permission-Aware Probing

**Use when:** running probes, HTTP checks, git commands, or process tests inside a permissioned sandbox.

## Pitfalls

- curl/web-fetch denied → subagents stall or return empty instead of adapting.
- git commands blocked ("ask" policy) → tasks return empty.
- Compound commands / heredocs blocked.
- `pkill -f <tool>` killing the orchestrating session itself.

## Rules

1. If curl is denied, use `python3 urllib` for HTTP checks.
2. Use sandbox git allowlist forms exactly (`git status *`, `git diff *`, `git log *`, `git show *`) with no pipes; verify ignore-status via `git status`, not `check-ignore`.
3. Prefer single, simple commands over heredocs/compounds.
4. Kill background processes by PID only: capture `$!`, `kill $PID`, verify with `kill -0`, escalate to `-9` only if needed; confirm stopped before continuing.
5. If a probe is blocked, report which mechanism was used and paste the denial — never silently skip.