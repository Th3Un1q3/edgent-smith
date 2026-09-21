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
4. **Parity:** remote runs `just ci` verbatim (`runCmd: just ci`). Keep `scripts/ci.sh` (12 gates, sequential) and `.github/workflows/ci.yml` in sync.
5. **Gate it:** add `grep -R "devcontainers/ci@"` count = 5 to `just verify-agents` gate 10.

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
