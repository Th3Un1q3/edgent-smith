## Tests for plugins directory

### Directory Structure

| Path | Purpose | Naming Convention |
|------|---------|-------------------|
| `*.test.ts,**/*.test.ts` | Unit and integration tests for the plugin | Structure and file names map 1:1 to source files. eg. source file `todo-enforcer.ts` -> test file `tests/todo-enforcer.test.ts`. Same naming and folder structure with `tests/` directory and `.test.ts` suffix |
| `__utils__` | Test utilities and helpers, mocks generators, modules mocks | For a module `module-name.mock.ts` (replace `module-name` with the actual module name), for helpers - kebab case filenames representing their domain (eg `context-builder.ts`) |

Live checks are delegated CLI/agent runs, not test files, and must not be added to this directory.

### Repository Root

Tests must not derive the checkout root from their own path with fixed hops, from a literal absolute path, or from `process.cwd()`; import `REPO_ROOT` from `tests/helpers/repo-root`, and only a temp-directory fixture may build its own tree. The mutation gate runs the suite inside a Stryker sandbox, so a sandbox-derived root silently points at a path that has no fixtures.
