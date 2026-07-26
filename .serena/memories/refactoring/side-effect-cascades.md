# Side-Effect Cascades in Plugin Refactoring

Specific failure patterns encountered during the `.opencode/plugins/` refactoring.

## 1. Type Declaration Merge (bun.d.ts)

Merging two overlapping Bun type declarations (`declare namespace Bun` vs `declare module "bun"`) seemed safe but had a hidden dependency: files using `Bun.file()` as a **global** (without import) depend on the `declare namespace Bun` style. Deleting that file without verifying every consumer caused 14 typecheck errors.

**Lesson**: Before deleting a type declaration file, grep for ALL patterns it provides — not just the types/modules it contains, but also the resolution context (global vs import).

## 2. Logger Signature Change

Changing `log(client, level, message)` to `log(client, level, message, pluginId?)` seemed backward-compatible (optional param) but broke every `toHaveBeenCalledWith` assertion that checked the exact number of arguments. Even though the `pluginId` parameter is optional in the function signature, vitest's `toHaveBeenCalledWith` matches exact arguments.

**Lesson**: Adding an optional parameter to a function that's called in test assertions will still break every assertion because vitest counts arguments strictly. Use `expect.any(String)` or `expect.anything()` for new optional trailing args in assertions.

## 3. Mock Factory Dependency Chain

Removing `SessionStorage.reset()` from the real class caused cascading failures through:
- The mock factory (`kv-store.mock.ts`) that implemented `reset`
- All 6 test files that called `SessionStorage.reset()` in `beforeEach`
- Each test file had a different import pattern for the reset method

The fix required updating 7 files for one dead method removal.

**Lesson**: When removing an exported symbol, use `grep -r` for the symbol across ALL files (not just source files). Every test file that imports it directly is a required edit.