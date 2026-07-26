# Restructuring Patterns for Plugin Code

Effective patterns for restructuring OpenCode plugin code, discovered during the refactoring.

## 1. Inner Closure vs Module Scope

Per vitest mock isolation rules, functions that call mocked imports must be defined inside the plugin factory function (as inner closures), not at module scope. Pure functions (no mocked imports) are safe at module scope.

**Rule of thumb**: If a helper calls `sendMessage`, `log`, `runGate`, `updateState`, `Bun.file`, or any other module that gets vi.mocked in tests, define it inside the factory. If it's a pure computation or string formatting, module scope is fine.

## 2. Extracting Boolean Parameters

When extracting a function with boolean parameters, name them with `is`/`has` prefixes (`isDirty`, `hasResults`) to satisfy `unicorn/consistent-boolean-name`. The `dirty` parameter was flagged because the linter enforces this strictly.

## 3. Type Narrowing with `unknown` Instead of `any`

Use `Promise<unknown>` + internal `as` cast instead of `Promise<any>` for API response types. This satisfies `@typescript-eslint/no-explicit-any` while still providing flexibility. Pattern used in `agent-steps.ts` for `getSessionAgent()`.