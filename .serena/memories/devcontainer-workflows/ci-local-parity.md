# CI-local parity: run every gate in the same devcontainer image

**Use when:** editing `.github/workflows/ci.yml`, `scripts/ci.sh`, `scripts/ci_ensure_env.sh`, or docs that state the CI gate count.

## Rules
1. Parity means one image runs the gates. Both the prebuild and the `ci` job execute `just ci` inside the same devcontainer build of `.devcontainer/`, using `devcontainers/ci@v0.3.1900000450`. The host does env prep and cache plumbing only; it never runs the test/lint/typecheck gates directly.
2. Prepare the environment before the container boots. Compose reads `.devcontainer/.env` at boot, so any env file the compose service expects must exist first. Share that prep between both jobs through `scripts/ci_ensure_env.sh` instead of duplicating inline steps.
3. Do not treat a green prebuild as a green gate run. The prebuild job builds the image and runs postCreate (`setup-dev.sh`); it can pass while the in-container gate run fails. The recurring failure mode is `setup-dev.sh` hardlinking files across filesystems (or into/out of a volume), which succeeds on one path and fails on the other.
4. `scripts/ci.sh` is the single source of truth for what CI runs and for the gate count (13). When you add or remove a gate, update the script and every doc that states the number in the same change; keep `.github/workflows/ci.yml`'s job graph in sync (`prebuild-devcontainer` + `ci` with `needs`).
5. Prefer `just ci` over re-listing individual gates in YAML; the script stays authoritative and the workflow stays thin.

Anchor: `.github/workflows/ci.yml`, `scripts/ci.sh`, `scripts/ci_ensure_env.sh`, `.devcontainer/`, `justfile` (root `ci`, `ci-fast`).
Source: CI simplification pass to devcontainer-only gates, 2026-09-21.