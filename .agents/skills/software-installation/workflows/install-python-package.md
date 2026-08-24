# Workflow: Install a Python Package

Install and manage Python packages with uv, per this repo's conventions, so the environment stays reproducible and syncs cleanly from pyproject.toml.

**Tools:** `uv` (run via `uv run` or the project's justfile recipes). **Prerequisites:** a devcontainer with uv installed and a pyproject.toml at the repo root declaring the dependency groups.

**Order of operations:** choose the target → declare the dependency → sync → verify the import.

## Step 1 — Choose the install target

Match the target to the use:
- Project dependency → add it to the right dependency group in pyproject.toml and sync.
- Standalone CLI tool → `uv tool install`.
- One-off script → `uvx` without installing anything.

Done when: the target matches the declared use.

## Step 2 — Declare the dependency in pyproject.toml

Add the package to the appropriate dependency group (for example the `[dependency-groups]` dev section) with a pinned or compatible version. Keep group membership the single source of truth; avoid pip-installing ad hoc into the project environment.

Done when: `uv lock` resolves the new dependency cleanly.

## Step 3 — Sync the environment

Sync the dev environment including all extras and groups in one command:

```bash
uv sync --dev --all-extras
```

Done when: `uv sync` exits 0 and reports the environment up to date.

## Step 4 — Install standalone tools with uv tool

Install CLIs into uv's managed tool directory; they stay on PATH for the dev user.

```bash
uv tool install <tool>@<version>
```

Done when: `<tool> --version` resolves in a fresh shell.

## Step 5 — Run one-offs with uvx

Run scripts or ephemeral tools without polluting the project environment:

```bash
uvx <package>@<version> <args>
```

Done when: the command runs and the environment stays unchanged.

## Step 6 — Verify the import

Import the package from the synced environment and print its version:

```bash
uv run python -c "import <pkg>; print(<pkg>.__version__)"
```

Done when: the import resolves and the version matches pyproject.toml.

## Acceptance criteria

- Dependencies live in pyproject.toml groups and resolve with uv.
- `uv sync --dev --all-extras` reproduces the environment.
- Imports and versions verify against the installed artifact.

## Example application: dev-group formatter

Add the repo's formatter (ruff) to the dev dependency group, run `uv sync --dev --all-extras`, then verify `uv run ruff --version` resolves.
