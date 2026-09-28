# Running Tests — Project Commands

**Load this reference when:** writing or changing tests and needing to run them.

Use `just` targets, never raw runners.

```bash
just test
just test --coverage
just test -- plugins/tests/skills-loader.test.ts
just lint
just typecheck

# Whole mutation suite — long runtime, run only for final verification before release
just mutation
# Mutation scoped to one plugin file, to confirm that file is well tested
just mutation --mutate plugins/todo-enforcer.ts
```

Never call the underlying tools directly (`pytest`, `npm test`, `vitest`, `bun`, `tsc`). The `just` targets run tests, lint, and typecheck the same way production does.

## Python Execution and Virtualenvs

Skip manual venv activation (`source .venv/bin/activate`). Run Python with `uv run <command>` or a `just` recipe; `uv run` resolves the project environment without activation. For tests, lint, and typecheck still use the `just` targets above, not `uv run pytest`/`uv run mypy`.

## Per-File Verification

Verify each file as you finish it: after editing a file, run the relevant per-file check (`just test -- <path-to-file>`, or lint/typecheck scoped to that file) before moving on. A file is not done until its check passes or the failure is documented.

Per-file verification consumes tool calls. Reserve budget for it; if the budget cannot cover everything, verify the most critical subset and report which files were not verified.
