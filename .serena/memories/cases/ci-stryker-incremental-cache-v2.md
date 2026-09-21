---
id: cases/ci-stryker-incremental-cache-v2
type: cases
L0: "Stryker CI cache v2: split dep-hash vs source-hash (restore-keys prefix = dep hash); save-gate uses host `test -f` marker, never hashFiles() on gitignored paths; chmod a+rwX after restore; dep hash needs tracked lockfile + pinned toolchain."
hotness: 0.85
ttl: 180d
version: 1
freshness: 2026-09-21
directory: cases
provenance: "Hardening Stryker incremental cache in .github/workflows/ci.yml, 2026-09-21"
---
# Robust incremental Stryker cache in the CI workflow
The incremental cache must key on the things that invalidate the mutant graph, and the save/restore plumbing must survive a host/container uid split.

## v2 key segmentation
- Two hashes: a dependency/toolchain hash over lockfiles + pinned versions, and a source hash over mutated source.
- `key` uses both; `restore-keys` prefixes on the dependency hash only.
- Effect: dependency/toolchain drift never cross-reuses a stale cache, while a source-only change warm-falls-back to the dep-matched cache instead of a cold run.
- Cache is scoped per PR ref so parallel PRs do not thrash one shared entry.

## Save gate: never hashFiles() a gitignored path
- `hashFiles()` follows gitignore semantics, which are contested, and `.opencode/reports/` is gitignored, so it can resolve empty and silently disable the save.
- Use a host `test -f <marker>` step that emits a step output, then gate the save on that output. File-existence is decided by the filesystem, not by hashFiles/gitignore.

## uid normalization after restore
- The cache is written by the container user (vscode uid 1000) and may be restored onto the host, and vice versa. A host-restored file the container cannot overwrite breaks the run.
- Run `chmod -R a+rwX <cache path>` after restore so uid 1000 can overwrite and the host can read the container-written result.

## Dependency provenance must be real
- The dep hash is empty if the lockfile is gitignored: `.opencode/bun.lock` was ignored, so dependency changes were invisible to the cache key. Track the lockfile.
- Pin the toolchain: `bun` resolved from `latest`, so the same commit could hash differently over time. Pin the version.

## Path-limited commit
- When unrelated user WIP is staged in the same index, `git commit -- <paths>` (or `git commit <paths>`) commits only the intended files.
- Verify staged scope with `git status --porcelain` before committing.

Anchor: `.github/workflows/ci.yml`, `scripts/ci.sh`, `.opencode/reports/`, `.opencode/bun.lock`.
Source: hardening pass on the CI workflow, 2026-09-21.