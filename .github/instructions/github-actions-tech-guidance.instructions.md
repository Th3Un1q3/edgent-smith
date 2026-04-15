---
description: GitHub Actions guidance for DevContainers and action output variables.
applyTo: ".github/workflows/**/*.yml"
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
      - uses: devcontainers/ci@v0.3
        with:
          runCmd: |
            just test
```

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

If your workflow needs to run a specific Python script, do it from the repo root with `uv run` or `python` inside the container.

> Tip: If this repository uses a local environment file, create `.env` from `.env.example` before entering `devcontainers/ci`, not inside `runCmd`. The mounted workspace needs the file available when the container starts.

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
