# Complexity Refactoring Patterns

Behavior-preserving refactor techniques for lowering cyclomatic complexity, proven in the complexity-linter session (full suites green afterwards: 520 vitest + 234 pytest).

## TypeScript (OpenCode plugins)

- ESLint 10 counting: optional chaining (`?.`) counts as a decision point; nested functions are separate code paths. `node_modules/eslint/lib/rules/complexity.js` is the authoritative way to reproduce counts.
- Helper extraction for vitest: pure predicates go to module scope; helpers calling mocked imports (client, sessionStorage, kv-store) go to inner closures (vitest mock isolation). The repo `unicorn/consistent-function-scoping` rule (error for plugin source) forces pure predicates to module scope anyway.
- Type narrowing: after a guard narrows a value to a literal union member, comparing it with another member (e.g. `newStatus === currentStatus` where `currentStatus` is `unknown`) is provably false — TS2367. Restore the original semantics with an explicit cast (`newStatus as GateResult`).

## Python

- Replace nested conditionals with dict lookup tables keyed by (field, error_type).
- Prefer guard clauses and named `_helper` extraction over deeper nesting.

## Proven on (before → after)

- TS: quality-gate-enforcer.ts before-hook 15→8, after-hook 19→5; skills-loader.ts 19→7; todo-enforcer.ts 9→5, 11→7, 13→3; helpers/instruction-indexer.ts 16→6; helpers/gate-formatter.ts 13→6.
- Python: cli/commands/init.py `_render_validation_error` 11→2; scripts/experiment.py `run_local_loop_iteration` 11→3.

Foundations: mem:refactoring/restructure-patterns (inner closure vs module scope, boolean parameters, narrowing with `unknown`).