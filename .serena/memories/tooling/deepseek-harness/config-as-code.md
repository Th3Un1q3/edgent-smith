# dsh Config Must Be Repo-Tracked (Config-as-Code)

Config written in the container before the volume exists is lost on first rebuild: the fresh empty `dsh_data` volume shadows the pre-volume `~/.dsh` files. Rebuild-sensitive home config must live in the repo (workspace mount persists) and be installed idempotently.

Pattern (dsh): templates at `.devcontainer/dsh/{settings.yaml,cordis.patch.yml}` are restored by setup-dev.sh with `cp -u` guarded by `[[ -f ]]` — user edits in `~/.dsh` with a newer mtime survive; an empty home gets templates; version changes propagate. This is the dsh equivalent of opencode repo-level harness (`.opencode/`).

Companion fix: mem:tooling/deepseek-harness/volume-ownership (volume must be writable before restore).