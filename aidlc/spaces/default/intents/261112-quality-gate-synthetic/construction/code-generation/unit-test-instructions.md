# Unit Test Instructions

## Framework and configuration

- Runner: Vitest through Bun, configured by `.opencode/vitest.config.ts`; aliases `@plugins/*` and `@tests/*` come from `.opencode/tsconfig.json` and are test-only.
- The harness pattern: build a fake `Context` (storage, session hooks, tool hooks), then `Effect.runPromise(Effect.scoped(plugin.effect(context)))` and drive the captured hooks.
- Tests are hermetic: no network, no model call, no real shell gate run. `runGate` and `loadQualityGates` are mocked in the plugin suite.

## How to run these tests

Run from the repository root. Step 1 confirms the accepted path form and records it.

```bash
# The touched suites, scoped (never a bare project-wide command)
just .opencode/test -- plugins/tests/quality-gate-enforcer.test.ts plugins/tests/helpers/tool-input.test.ts plugins/tests/helpers/steering-message.test.ts plugins/tests/helpers/gate-formatter.test.ts plugins/tests/helpers/gate-runner.test.ts plugins/tests/helpers/instruction-payload.test.ts plugins/tests/instructions-loader.test.ts plugins/tests/types/quality-gate.test.ts

# One file while iterating
just .opencode/test -- plugins/tests/quality-gate-enforcer.test.ts

# Lint and typecheck
just .opencode/lint
just .opencode/typecheck

# Coverage (the project-wide floor, judged on the full suite)
just .opencode/test --coverage
```

## Expected coverage targets

- The project-wide floor is 90% for branches, functions, lines, and statements, enforced by the plugin coverage configuration.
- That floor is judged by Build and Test on the **full** plugin suite. A scoped run does not judge it; a coverage-threshold exit with every selected test passing is recorded as such, not as a failed test.
- This change adds no extra Unit-scoped coverage target. Its obligation is that the scoped suites stay green and the existing floor is not lowered.

## Test ordering (TDD)

Every behaviour follows Red → Green → Refactor, as the plan's steps say:

1. Write the failing test and run its scoped command; record the failing output.
2. Implement only enough to pass.
3. Refactor while green.

The strict-improvement rule for gates is unchanged: no threshold is lowered to make a step pass.

## Mocking and stubbing

- `vi.mock('@plugins/helpers/gate-config', ...)` and `vi.mock('@plugins/helpers/gate-runner', ...)` with alias paths, then `vi.mocked(...)`.
- The fake `Context` supplies `location.directory`, `storage` (`get`/`set`/`remove`), `tool.hook`, and `session.synthetic`. The updated harness also records synthetic appends in a `synthetics` array and keeps a `prompts` array so a case can assert that no prompt was used.
- Functions that call a mocked import stay inside the plugin `effect` closure, so they share the test's mock instances.

## Test data

- Gate configurations are literals in each test (`{ name, patterns, commands }`).
- Shared fixtures live in `.opencode/plugins/tests/fixtures/`; do not add new fixture files unless a case needs one.
- `REPO_ROOT` comes from `@tests/helpers/repo-root`; never derive the checkout root from the test file path or `process.cwd()`.

## Tests written but not executed in this stage

None at plan time. Any case that cannot run in this environment will be recorded in `code-summary.md` with its reason.
