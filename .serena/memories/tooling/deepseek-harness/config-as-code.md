# dsh Config Must Be Repo-Tracked (Config-as-Code)

Home-dir harness config is rebuild-sensitive: container-init config written before a named volume exists is lost on the first rebuild (a fresh empty `dsh_data` volume shadows pre-volume `~/.dsh` files). Rebuild-sensitive harness config must live in the repo (workspace mount persists) — never only in the container home.

Pattern (dsh, current): the harness home IS the workdir. `.devcontainer/docker-compose.yml` bind-mounts `../.dsh:/home/vscode/.dsh` instead of the `dsh_data` named volume, so `~/.dsh` is `.dsh/` in the repo: tracked config (`settings.yaml`, `cordis.patch.yml`, `agent-presets/`) persists with the repo, machine state (`profiles/`, `sessions/`, `storages/`, `.pnpm-store/`) is gitignored (root `.gitignore` section "dsh harness home"), and there is NO copy/restore step in setup-dev.sh. Roster discovery is unmemoized, so preset edits under `.dsh/agent-presets/` are live for the next session.

Historical pattern (superseded): templates at `.devcontainer/dsh/{settings.yaml,cordis.patch.yml}` were restored by setup-dev.sh with `cp -u` guarded by `[[ -f ]]`. Same idea — repo as source of truth — but it needed an idempotent copy and repaired only config files, not presets. A symlinked `~/.dsh/.agent-presets` into the workdir was another intermediate stopgap; the bind mount replaces both.

Migrating a pre-mount container once: `rsync -a --exclude='.agent-presets' ~/.dsh/ /workspace/.dsh/`, then rebuild the devcontainer so the compose bind mount takes effect. Orphan `dsh_data` volume can be removed with `docker volume rm dsh_data`.

Companion fix: mem:tooling/deepseek-harness/volume-ownership (volume must be writable before restore).