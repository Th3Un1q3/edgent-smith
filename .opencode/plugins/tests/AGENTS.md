## Tests for plugins directory

### Directory Structure

| Path | Purpose | Naming Convention |
|------|---------|-------------------|
| `*.test.ts,**/*.test.ts` | Unit and integration tests for the plugin | Structure and file names map 1:1 to source files. eg. source file `todo-enforcer.ts` -> test file `tests/todo-enforcer.test.ts`. Same naming and folder structure with `tests/` directory and `.test.ts` suffix |
| `__utils__` | Test utilities and helpers, mocks generators, modules mocks | For a module `module-name.mock.ts` (replace `module-name` with the actual module name), for helpers - kebab case filenames representing their domain (eg `context-builder.ts`) |