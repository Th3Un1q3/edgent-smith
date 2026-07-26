# Enforcing Import Alias Rules Between Source and Test Files

OpenCode plugin projects use a split convention:
- **Source files** (in `plugins/` and `plugins/helpers/`): MUST use relative imports (`./foo`, `../types/bar`)
- **Test files** (in `plugins/tests/`): MAY use alias imports (`@plugins/foo`, `@tests/bar`)

This is because the OpenCode runtime does NOT resolve `tsconfig.json` path aliases, but Vitest + tsconfig-paths does in test mode.

## Why This Rule Is Violated

- No ESLint rule enforces it (the `@typescript-eslint/no-restricted-imports` rule in the config only restricts `../` and `./` in test files, not `@plugins/` in source files)
- Developers naturally reach for the alias because it's shorter
- `tsc --noEmit` doesn't catch it in source files when the alias is configured in `tsconfig.json`

## How to Detect

Manually grep for `from '@plugins/` in source files (not test files):
```
grep -rn "from '@plugins/" plugins/*.ts plugins/helpers/
```

## How to Fix

Simply replace `@plugins/types/quality-gate` with the relative equivalent: `../types/quality-gate`.

## Prevention

Add an ESLint `no-restricted-imports` rule for source files that blocks `@plugins/` and `@tests/` patterns, or add a CI check script.

## Cross-References

- mem:refactoring/plugin-imports - original discovery of this architectural constraint
- mem:quality-gates/configuration - how lint gates work
