## Tests for plugins directory

### Directory Structure

| Path | Purpose | Naming Convention |
|------|---------|-------------------|
| `tests/**/*.test.ts` | Unit and integration tests for the plugin | Structure and file names mirror the source, scope directory included: `gates/run.ts` -> `tests/gates/run.test.ts`, `state-machine/core/signals.ts` -> `tests/state-machine/signals.test.ts`, with a `.test.ts` suffix |
| `tests/helpers` | Shared test utilities: mock factories, harnesses and fixture builders | Kebab-case filenames naming their domain (`shared-mocks.ts`, `plugin-builder.ts`, `client-factory.ts`), and one folder per source scope (`instructions/`, `runtime/`, `session/`, `state-machine/`, `tool-limit-reminder/`) |
| `tests/workflow/` | Shared workflow test helpers: harness config, plugin mocks, plugin state and subtask fixtures | Kebab-case filenames naming their domain (`plugin-mocks.ts`, `plugin-state.ts`, `subtask-fixtures.ts`) |

Live checks are delegated CLI/agent runs, not test files, and must not be added to this directory.

### Fakes mirror the host, not the plugin

A fake `Context` that invents a payload shape keeps the suite green while the live path silently does nothing. Copy every hook and event payload from the installed `@opencode/schema` / `@opencode/plugin` types, and when a payload is hand-built (an inbox item, a hook event), name the schema file in the helper. One example: `session.inbox.enqueued` carries `data.item.type` and `data.item.payload.text`. A hook change is then proved by the live run in `.opencode/instructions/live-verification.instructions.md`, not by the fake.

### Repository Root

Tests must not derive the checkout root from their own path with fixed hops, from a literal absolute path, or from `process.cwd()`; import `REPO_ROOT` from `tests/helpers/repo-root`, and only a temp-directory fixture may build its own tree. The mutation gate runs the suite inside a Stryker sandbox, so a sandbox-derived root silently points at a path that has no fixtures.
