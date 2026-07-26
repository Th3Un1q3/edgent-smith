# Plugin Import Architecture: Aliases Are Test-Only

A critical architectural finding: the OpenCode plugin system does NOT resolve TypeScript `paths` aliases from `tsconfig.json`.

## The Two Contexts

| Context | Import Style | Resolution |
|---------|-------------|------------|
| Plugin source files (`plugins/*.ts`) | Relative imports only (`./helpers/...`, `../types/...`) | bun module loader — no alias resolution |
| Test files (`plugins/tests/**/*.ts`) | Alias imports (`@plugins/...`, `@tests/...`) | Vitest + tsconfig-paths resolves tsconfig.paths |

## Why This Matters

- Using `@plugins/helpers/logger` in a source file compiles with tsc but FAILS at runtime
- The `tsconfig.json` defines these aliases, creating the illusion they work everywhere
- Developers new to the codebase will naturally use them unless explicitly told otherwise

## Documentation

The rule is now codified in:
- `opencode-plugin-interfaces.instructions.md` (Import Conventions section)
- `plugin-tests-imports.instructions.md` (warning callout)
- `plugins/AGENTS.md` (brief note)