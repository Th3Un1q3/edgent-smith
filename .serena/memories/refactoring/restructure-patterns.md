# Restructuring Patterns for Plugin Code

## 1. Inner Closure vs Module Scope

Per vitest mock isolation rules, functions that call mocked imports must be defined inside the plugin factory function (as inner closures), not at module scope; pure functions (no mocked imports) are safe at module scope. Rule of thumb: if a helper calls any module that gets `vi.mocked` in tests (e.g., `sendMessage`, `log`, `runGate`, `updateState`, `Bun.file`), define it inside the factory; if it's a pure computation or string formatting, module scope is fine.

## 2. Extracting Boolean Parameters

When extracting a function with boolean parameters, name them with `is`/`has` prefixes (`isDirty`, `hasResults`) to satisfy `unicorn/consistent-boolean-name`, which the project linter enforces strictly.

## 3. Type Narrowing with `unknown` Instead of `any`

Use `Promise<unknown>` + internal `as` cast instead of `Promise<any>` for API response types. This satisfies `@typescript-eslint/no-explicit-any` while still providing flexibility — e.g., for session agent response helpers.
