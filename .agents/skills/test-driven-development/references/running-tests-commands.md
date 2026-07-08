# Running Tests — Project Commands

**Load this reference when:** writing or changing tests and needing to run them. Every project has its own test runner; always use the commands below rather than guessing `npm test`, `pytest`, etc.

## Root Python Project (test-driven-development)

| Action | Command | Notes |
|---|---|---|
| Run full suite | `just test` | Default: `uv run pytest tests/ -q` |
| Run specific file(s) | `just test path/to/file.py` | Accepts any pytest arguments after the path |
| Run with verbose output | `just test -v` | One assertion failure per line, full traceback |
| Run a single test function | `just test tests/test_file.py::test_name` | Double colon = specific function; use `-k` for pattern matching |
| Run with coverage | `uv run pytest --cov=.` | Requires `pytest-cov` in dev dependencies |

**How it works:** `just test` delegates to `uv run pytest`. The `ARGS` default is `tests/ -q` (quiet mode, all tests). Append any valid pytest flags after the path.

## OpenCode Plugins (.opencode/)

| Action | Command | Notes |
|---|---|---|
| Run full suite | `cd .opencode && just test` | Runs `vitest run` from `.opencode/package.json` |
| Watch mode (re-run on change) | `cd .opencode && just test:watch` | Runs `vitest` in watch mode |

**How it works:** OpenCode plugins are a TypeScript project under `.opencode/`. The `just test` script is defined as `vitest run` in `.opencode/package.json`. Tests live in `.opencode/plugins/tests/`.

## Quick Decision

| Your need | Run this |
|---|---|
| Test changes to Python source or project tests | `just test [ARGS]` (from repo root) |
| Test changes to OpenCode plugin code | `cd .opencode && just test` |
| Verify the full suite is green before proceeding | Run both commands above — project tests then plugins |
