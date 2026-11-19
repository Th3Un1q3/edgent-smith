## Tests for plugins directory

### Directory Structure

| Path | Purpose | Naming Convention |
|------|---------|-------------------|
| `*.test.ts,**/*.test.ts` | Unit and integration tests for the plugin | Structure and file names map 1:1 to source files. eg. source file `todo-enforcer.ts` -> test file `tests/todo-enforcer.test.ts`. Same naming and folder structure with `tests/` directory and `.test.ts` suffix |
| `__utils__` | Test utilities and helpers, mocks generators, modules mocks | For a module `module-name.mock.ts` (replace `module-name` with the actual module name), for helpers - kebab case filenames representing their domain (eg `context-builder.ts`) |

Live checks are delegated CLI/agent runs, not test files, and must not be added to this directory.

### Fakes mirror the host, not the plugin

A fake `Context` that invents a payload shape keeps the suite green while the live path silently does nothing. Copy every hook and event payload from the installed `@opencode/schema` / `@opencode/plugin` types, and when a payload is hand-built (an inbox item, a hook event), name the schema file in the helper. One example: `session.inbox.enqueued` carries `data.item.type` and `data.item.payload.text`. A hook change is then proved by the live run in `.opencode/instructions/live-verification.instructions.md`, not by the fake.

### Repository Root

Tests must not derive the checkout root from their own path with fixed hops, from a literal absolute path, or from `process.cwd()`; import `REPO_ROOT` from `tests/helpers/repo-root`, and only a temp-directory fixture may build its own tree. The mutation gate runs the suite inside a Stryker sandbox, so a sandbox-derived root silently points at a path that has no fixtures.
