# Static Serve Gotchas (docs/, port 8000)

- SIGTERM to `just docs-serve` does NOT propagate to the underlying `node .../serve` child — the port stays bound after the recipe exits. Clean up with `pkill -f 'serve . -l 8000'`.
- Root `.gitignore` had to gain `docs/node_modules/` explicitly; the repo-wide `dist/` ignore would silently untrack a copied `docs/dist/`, so reference `node_modules/...` paths in HTML instead of copying assets.
- Commit `docs/bun.lock` — do NOT copy the `.opencode/.gitignore` precedent, which ignores `bun.lock` and its other lockfiles; docs needs its lockfile for reproducible installs.