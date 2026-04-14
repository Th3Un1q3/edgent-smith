---
description: Best practices for writing justfiles to ensure maintainability, clarity, and consistency across projects.
applyTo: "justfile,**/justfile"
---

# Best Practices for just tasks

Use `justfile` as the canonical source for project commands, not as a place for ad hoc shell scripts.

## 1. Configure execution explicitly
- Set a well-defined shell:
  ```just
  set shell := ["bash", "-euo", "pipefail", "-c"]
  ```
- Set a working directory if recipes should run from a specific project folder:
  ```just
  set working-directory := "src"
  ```
- Load environment from `.env` files if your project depends on local config:
  ```just
  set dotenv-load
  set dotenv-required
  ```

## 2. Keep recipes small and composable
- Prefer focused recipes like `test`, `lint`, `build`, `format`, and `release`.
- Avoid adding too much logic in a single recipe.
- Compose recipes by calling other recipes instead of duplicating work.

## 3. Use variables instead of repeating values
- Declare shared values once:
  ```just
  SOURCE_DIR := "src"
  PYTHON := "python"
  ```
- Reuse them in recipes and commands.
- Use `env_var_or_default("NAME", "default")` for environment-driven values.

## 4. Export only what is needed
- Use `set export` when many variables should be available in recipe commands.
- Or export individual variables explicitly:
  ```just
  export RUST_BACKTRACE := "1"
  ```
- Keep credential/secrets handling explicit and documented.

## 5. Justfile syntax reference
- Recipes use a colon after the name, followed by indented shell commands:
  ```just
  build:
    cargo build --release
  ```
- Pass parameters with defaults using `$` names:
  ```just
  serve $PORT="8080":
    ./server --port $PORT
  ```
- Use variadic parameters for multiple args:
  ```just
  backup +files:
    scp {{files}} user@server:/backup/
  ```
- Configure Just behavior with `set` directives:
  ```just
  set shell := ["bash", "-euo", "pipefail", "-c"]
  set dotenv-load
  set export
  set working-directory := "src"
  ```
- Comments start with `#` and appear in `just --list` output.
- Invoke recipes with `just <recipe>` or `just <recipe> arg`.

## 6. Parameterize recipes cleanly
- Define recipe parameters for configurable behavior:
  ```just
  serve $PORT="8080":
    ./server --port $PORT
  ```
- Parameter values can be exported to the environment if the underlying command expects them.

## 6. Document intent and requirements
- Add comments explaining why a recipe exists, which shell settings are chosen, and what env files are loaded.
- Document required tools or environment variables for project contributors.

## 7. Keep cross-platform assumptions isolated
- If you need platform-specific behavior, isolate it behind separate recipes or conditional logic.
- Prefer a consistent Unix-style shell in the repo, and document when Windows support is not expected.

## 8. Prefer `just` over shell boilerplate in CI and docs
- Use `just lint`, `just test`, and `just build` in docs so contributors have a single entrypoint.
- Avoid mixing shell commands with `just` commands in the same workflow unless necessary.

## 9. Fail early and loudly
- Configure shell strict mode to prevent hidden command failures.
- Use explicit commands rather than relying on shell fallback behavior.

## 10. Keep `justfile` readable
- Use comments, clear recipe names, and short recipe bodies.
- Avoid embedding large scripts directly; move complex logic to dedicated shell/Python scripts if needed.

