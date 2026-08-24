# dsh Rebuild Survivability (verified 2026-08-22)

After a devcontainer rebuild, verified surviving:

- `dsh --version` == 0.1.1-rc.2 — setup-dev.sh reinstalls on version mismatch.
- npm global bin resolves in fresh shells — setup-dev.sh exports `PATH="$(npm prefix -g)/bin:$PATH"` (not in containerEnv PATH).
- All repo files survive — workspace mount.
- `just dsh` / `just oc` work — repo-level recipes.
- forwardPorts 3080 (dsh web UI) intact — devcontainer.json.

The only rebuild-sensitive piece was `~/.dsh`; fixed via templates + chown. Post-restart check: `test -w ~/.dsh` then `dsh --profile web --dump-config`.

Fixes: mem:tooling/deepseek-harness/config-as-code, mem:tooling/deepseek-harness/volume-ownership.