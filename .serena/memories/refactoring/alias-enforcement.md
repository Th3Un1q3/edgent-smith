# Enforcing Import Alias Rules Between Source and Test Files

The source-relative / test-alias import split is part of the plugin import architecture — see mem:refactoring/plugin-imports. This memory covers enforcement: why the split gets violated and how to detect and prevent violations.

## Why This Rule Is Violated

- No ESLint rule enforces it (the `@typescript-eslint/no-restricted-imports` rule in the config only restricts `../` and `./` in test files, not `@plugins/` in source files)
- Developers naturally reach for the alias because it's shorter
- `tsc --noEmit` doesn't catch it in source files when the alias is configured in `tsconfig.json`

## How to Detect

Manually grep for `from '@plugins/` in source files (not test files):
```
grep -rn "from '@plugins/" <plugins-dir>/*.ts <plugins-dir>/helpers/
```

## How to Fix

Replace the alias import with its relative equivalent, based on the importing file's location — e.g., a plugin module importing a helper module uses `./helpers/<name>` instead of `@plugins/helpers/<name>`; shared types use `../types/<name>`.

## Prevention

Add an ESLint `no-restricted-imports` rule for source files that blocks `@plugins/` and `@tests/` patterns, or add a CI check script.

## Cross-References

- mem:refactoring/plugin-imports - original discovery of this architectural constraint
- mem:quality-gates/configuration - how lint gates work
