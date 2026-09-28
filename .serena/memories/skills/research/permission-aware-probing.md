# Permission-Aware Probing

**Use when:** running probes, HTTP checks, git commands, or process tests inside a permissioned sandbox.

## Pitfalls

- A denied probe is fuzzy/format (canonical form expected) or gated (final); the AFK denial message carries the hint when one exists - follow it.
- `pkill -f <tool>` can kill the orchestrating session itself.

## Rules

1. Follow the denial hint for the canonical form - see `.opencode/instructions/no-permission-workarounds.instructions.md`.
2. Gated actions and authorizations follow the permission policy - see `.opencode/instructions/no-permission-workarounds.instructions.md`.
3. Kill background processes by PID only: capture `$!`, `kill $PID`, verify with `kill -0`, escalate to `-9` only if needed; confirm stopped before continuing.
