---
name: github-actions-tech-guidance
description: GitHub Actions guidance for DevContainers and action output variables.
applyTo: ".github/workflows/**/*.yml"
excludeAgents: "rug"
---

# Using DevContainers in GitHub Actions

This repository is DevContainer-first. GitHub Actions workflows should build or reuse the configured development container and execute commands inside it rather than relying on the host environment.

## Recommended pattern

Use the official `devcontainers/ci` action to build and run steps inside the repo's `.devcontainer` definition.

Example:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devcontainers/ci@v0.3.1900000450
        with:
          runCmd: |
            just test
```
Pin once and count: `grep -R "devcontainers/ci@" --include="*.yml" .github/` must return exactly 5 hits (2 in `ci.yml`, 3 in `experiment.yml`). Current pin is `devcontainers/ci@v0.3.1900000450`. Update all 5 hits with one `sed` when bumping.

## Required CI hardening (P0)

Apply to every `.github/workflows/*.yml` that uses `devcontainers/ci`:

1. **Pin + timeouts:** `devcontainers/ci@v0.3.1900000450` + `timeout-minutes: 12` (prebuild) / `30` (ci, raised from 20 for mutation headroom) / `30` (experiment). Prevents `143`/`124` kills and drift.
2. **Env forwarding:** `devcontainers/ci` does NOT forward `env:` — use `with.env` block:
   ```yaml
   - uses: devcontainers/ci@v0.3.1900000450
     with:
       cacheFrom: ghcr.io/th3un1q3/edgent-smith
       env: |
         GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}
         DEVCONTAINER=true
       runCmd: |
         just ci
   ```
3. **Fork-PR conditional (prebuild only):** `GITHUB_TOKEN` is read-only on forks and push needs `packages:write`. Guard prebuild:
   ```yaml
   prebuild-devcontainer:
     if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository)
   ```
   Downstream `ci` must allow skip: `if: always() && (needs.prebuild-devcontainer.result == 'success' || needs.prebuild-devcontainer.result == 'skipped')`.
4. **Parity:** remote runs `just ci` inside the DevContainer (`runCmd` invokes `just ci` and preserves its exit code). Keep `scripts/ci.sh` (13 gates, sequential) and `.github/workflows/ci.yml` in sync.
5. **Gate it:** `scripts/verify_thresholds.sh` check #8 asserts `grep -R "devcontainers/ci@"` count = 5; it runs as Gate #0 inside `just verify-agents`.

## Stryker incremental cache

All quality gates run inside the DevContainer (`runCmd` invokes `just ci`). The host runs only checkout, `.env` bootstrap, and the cache plumbing around the container entry point: restore, permission normalization, and save for Stryker's incremental file `.opencode/reports/stryker-incremental.json`.

The cache key has two hash segments, and `restore-keys` repeats only the first:

```yaml
key: ${{ runner.os }}-stryker-v2-${{ hashFiles('.opencode/bun.lock', '.opencode/package.json', '.devcontainer/devcontainer.json', '.devcontainer/docker-compose.yml', '.devcontainer/setup-dev.sh') }}-${{ hashFiles('.opencode/plugins/**/*.ts', '.opencode/plugins/tests/**/*.test.ts', '.opencode/stryker.config.mjs', '.opencode/vitest.config.ts', '.opencode/tsconfig.json') }}
restore-keys: |
  ${{ runner.os }}-stryker-v2-${{ hashFiles('.opencode/bun.lock', '.opencode/package.json', '.devcontainer/devcontainer.json', '.devcontainer/docker-compose.yml', '.devcontainer/setup-dev.sh') }}-
```

- **Dependency/toolchain hash (first segment):** `.opencode/bun.lock` — commit it so it is present in the checkout — plus `.opencode/package.json` and the DevContainer toolchain inputs (`.devcontainer/devcontainer.json`, `docker-compose.yml`, `setup-dev.sh`), which can change mutant semantics. `just .opencode/deps` installs with `bun install --frozen-lockfile`, so the hashed lockfile matches the resolved dependency versions.
- **Source hash (second segment):** the mutatable plugins, tests, and configs. A source-only change misses the primary key and warm-falls-back through `restore-keys` to a cache produced by the same dependency/toolchain environment.
- **What invalidates what:** a source/test/config change makes the primary key miss but still restores the same-environment cache; a dependency or toolchain change alters the prefix too, so no older-environment cache can cross-reuse stale verdicts. Bump the `-v2-` epoch to invalidate wholesale (for example, a Stryker major schema change).
- **Save guard and marker:** validation runs in-container inside `runCmd`, after `just ci` and with its exit code preserved. It skips the save when `.opencode/bun.lock` is missing, and otherwise writes the marker `.opencode/reports/.stryker-cache-ok` only when the incremental file is non-empty (`-s`) and valid JSON (`python3 -c 'import json,sys; json.load(open(sys.argv[1]))'`). The host `Check Stryker cache marker` step (`if: always()`) then probes the marker and emits `present=true|false`; the save step runs only when `steps.stryker-cache.outputs.cache-primary-key != ''` and `steps.stryker-cache-marker.outputs.present == 'true'`. Never save an empty, partial, or corrupt file: a killed or timed-out run can leave truncated JSON.
- **Permission normalization is required:** restored files are owned by the runner uid (1001) while the container runs as `vscode` (1000). `mkdir -p .opencode/reports && chmod -R a+rwX .opencode/reports` (portable, no sudo) makes the restored directory and file writable by the container. Dropping this step leaves a 1001-owned cache file the container cannot overwrite.
- **Pin bun:** `.devcontainer/devcontainer.json` pins the bun feature to `"version": "1.4.2"`. A floating bun binary changes Vitest/Stryker runtime semantics; pinning keeps the hashed devcontainer inputs meaningful.

## Why this matters

- Ensures the same Python, Node, and toolchain versions used locally are also used in CI.
- Avoids duplication of dependency installation logic between the container and GitHub Actions.
- Makes workflows resilient to host-level differences.

## Passing environment variables

`devcontainers/ci` does not automatically forward top-level step-level `env:` into the container shell. Use `with.env` to pass values into the actual container command.

Example:
```yaml
- uses: devcontainers/ci@v0.3
  with:
    env: |
      GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}
      DEVCONTAINER=true
    runCmd: |
      just lint
```

## Using GitHub-provided output path variables

When a workflow step runs inside a container, GitHub exposes special environment variables that point to mounted files for outputs, environment files, path updates, and step summaries.

The standard variables are:

- `GITHUB_OUTPUT`: file path for setting step outputs
- `GITHUB_ENV`: file path for adding environment variables for subsequent steps
- `GITHUB_PATH`: file path for appending paths to the system `PATH`
- `GITHUB_STEP_SUMMARY`: file path for writing a step summary

These env vars are injected by GitHub Actions and should be used as file locations rather than regular shell variables when writing container-aware action code.

Example using `GITHUB_OUTPUT` in a DevContainer step:
```yaml
- uses: devcontainers/ci@v0.3
  with:
    runCmd: |
      echo "result=success" >> "$GITHUB_OUTPUT"
      echo "built=true" >> "$GITHUB_OUTPUT"
```

This writes step outputs into the file mounted by GitHub Actions, which later steps can consume as `${{ steps.<step-id>.outputs.result }}`.

## Running repo commands inside the DevContainer

Prefer the repository's `just` task runner inside the container.

- `just test`
- `just lint`
- `just eval`

If your workflow needs to run a specific Python script, prefer repository `just` recipes; otherwise run `python` from the repo root inside the container.

> Tip: If this repository uses a local environment file, create `.env` from `.env.example` before entering `devcontainers/ci`, not inside `runCmd`. The mounted workspace needs the file available when the container starts.
>
> Tip: Do not duplicate repository environment setup inside `devcontainers/ci` if the DevContainer image already includes the project environment. Run repo commands directly instead.

## When to use `devcontainer exec`

Use `devcontainer exec --workspace-folder . -- <command>` only for local debugging when the container is already running. In GitHub Actions, prefer `devcontainers/ci`.

## Detecting DevContainer execution

This repository uses an environment marker for DevContainer execution:
```bash
if [ "${DEVCONTAINER:-}" = "true" ]; then
  echo "Inside DevContainer"
else
  echo "Outside DevContainer"
fi
```

The CI container should already set this marker via the `.devcontainer/docker-compose.yml` or the GitHub Actions container environment.

## Example workflow step

```yaml
- uses: devcontainers/ci@v0.3
  with:
    runCmd: |
      just test
      just lint
```

## Tips

- Keep workflows small and delegate complex logic to `just` recipes or repo scripts.
- Do not install tools twice; rely on the DevContainer image and features instead.
- If a workflow step needs secrets, forward them explicitly via `with.env`.

## Lessons / pitfalls

- **`postCreateCommand` failures are infra, not code.** `devcontainers/ci` runs `bash .devcontainer/setup-dev.sh`; its hardlink handling has exited 1 while `prebuild-devcontainer` reported success. Treat a failing postCreate as environment setup, make `setup-dev.sh` idempotent, and confirm the log carries no hardlink warning.
- **A green prebuild does not imply a green gate job.** The two jobs run in different containers on different runners; prebuild only proves the image builds. Setup and gate failures surface in the `ci` job.
- **PR caches are ref-scoped.** A cache saved on a PR merge ref is not readable by `main`; `main`'s caches are readable by PRs. A PR can warm-fall-back to `main`'s cache, but `main` only benefits from caches it saved itself.
- **Never let `restore-keys` cross a dependency or toolchain change.** The prefix repeats only the dependency/toolchain hash, so a lockfile or DevContainer toolchain change cannot restore stale mutation verdicts from an older environment.
- **`hashFiles` cannot see an untracked or gitignored lockfile.** A lockfile that is not committed drops out of the cache key silently, so resolved-dependency drift reuses older mutant verdicts. Keep `.opencode/bun.lock` committed and tracked (it is no longer in `.opencode/.gitignore`) and install it with `bun install --frozen-lockfile`; otherwise the dependency hash is dead at key time.
- **Pin toolchains.** The bun feature is pinned (`"version": "1.4.2"`); `latest` drifts and changes Vitest/Stryker mutant semantics without invalidating the cache key.
- **Normalize cached-file ownership across the uid boundary.** The host runner uid (1001) owns restored files; the container runs as `vscode` (1000). `chmod -R a+rwX .opencode/reports` before entering the container keeps the increment file writable.
