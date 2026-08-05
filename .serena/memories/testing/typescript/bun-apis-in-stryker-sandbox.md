# Bun-Specific API Calls Are Vulnerable in Stryker Sandbox

When a test calls `Bun.file()`, `Bun.write()`, or other Bun-specific APIs without mocking, it works in normal `vitest` runs but breaks in Stryker's sandbox.

## Root Cause

Stryker copies source files to a temp directory for mutation testing. In this sandbox context:
- `Bun.file('/nonexistent/path')` returns `undefined` instead of a Bun file object
- Calling `.json()` on `undefined` throws `TypeError: Cannot read properties of undefined`
- The error has no `code` property (unlike Bun's native ENOENT error)
- Catch blocks that check `error.code === 'ENOENT'` fail to match

## Fix

Always mock Bun file operations in tests that call load functions using them:

```typescript
const error = new Error('ENOENT: no such file or directory') as Error & { code: string }
error.code = 'ENOENT'
vi.spyOn(Bun, 'file').mockReturnValue({
  json: vi.fn().mockRejectedValue(error),
} as unknown as ReturnType<typeof Bun.file>)
```

## Detection

Tests that call functions using `Bun.file()` without mocking:
- Gate config loader tests
- Any test loading JSON files via Bun
- Any test reading from the filesystem via Bun

## Cross-References

- mem:quality-gates/configuration - quality gates system configuration
