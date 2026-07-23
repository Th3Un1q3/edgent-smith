---
name: plugin-tests-imports
description: "Import conventions for TypeScript test files under .opencode/plugins/tests/."
applyTo: ".opencode/plugins/tests/**/*"
---

## Aliases

Alias reference table (primary lookup):

| Alias | Resolves To | Use Case |
|---|---|---|
| `@tests/helpers/mock-utilities` | `.opencode/plugins/tests/helpers/mock-utilities.ts` | Test helpers and utilities |
| `@tests/__utils/kv-store.mock` | `.opencode/plugins/tests/__utils/kv-store.mock.ts` | Mock factories for KV store |
| `@plugins/instructions-loader` | `.opencode/plugins/instructions-loader.ts` | Source module under test |
| `@plugins/helpers/<module>` | `.opencode/plugins/helpers/<module>.ts` | Plugin helper modules (logger, session-helpers, etc.) |
| `@plugins/rug-team` | `.opencode/plugins/rug-team.ts` | Source module under test |
| `@opencode-ai/plugin` | external SDK type package | External plugin SDK types |

## Import Order

Numbered import rules for test files:

1. Vitest runtime imports (`vi`, `describe`, `expect`, `it`, `beforeEach`) — blank line after group
2. Mock factories and synchronous helpers (comment to flag circular-dependency avoidance)
3. `vi.mock()` calls at file top (vitest hoists these automatically)
4. Stub imports for mocked modules (import after the corresponding `vi.mock()`)
5. Remaining source imports via aliases

## Mocking

Required patterns:

```typescript
// Correct — alias paths in vi.mock() and stub import
vi.mock("@plugins/helpers/kv-store", () => makeKvStoreMockFactory())
import { kvStore } from "@plugins/helpers/kv-store"

// Correct — factory pattern for complex mocks (stored in __utils/factories/)
vi.mocked(kvStore.createSession).mockReturnValue({ sessionId: "test-123" })
```

Rules:

- All `vi.mock()` paths use aliases, never relative strings.
- Complex mock factories live in `__utils/factories/` — import via `@tests/__utils/factories/<name>` alias.
- Access mock instances with `vi.mocked(module.property)` after the stub import.

## Test Helpers

Test infrastructure paths:

| Helper Location | Alias Import | Purpose |
|---|---|---|
| `__utils/kv-store.mock.ts` | `@tests/__utils/kv-store.mock` | KV store mock factory |
| `helpers/mock-utilities.ts` | `@tests/helpers/mock-utilities` | Shared test utilities |

Note: `__utils/` has a single trailing underscore, not double. Import via the `@tests/__utils/<module>` alias.

## Mock-Aware Function Scoping

When extracting helper functions from plugin code for testability, be aware of vitest's mock isolation behavior.

### The Problem

Vitest's `vi.mock()` creates separate mock instances per module. If you extract a function that calls a mocked import to **module level** (outside the plugin function body), vitest may give it a different mock instance than the one your test file accesses. The function will call the real implementation (or a different mock), and your test assertions will fail invisibly.

```typescript
// WRONG: module-level function — different mock instance in tests
async function sendResults(outcomes, sessionID, client) {
  await sendMessage({ client, sessionId: sessionID, message: "result" })
  // ↑ sendMessage may be a different mock than what the test expects
}

export const myPlugin: Plugin = async ({ client }) => {
  // ... plugin body uses sendResults from module level
}
```

### The Rule

**Functions that call mocked imports (`sendMessage`, `runGate`, `log`, etc.) MUST be defined inside the plugin function body as inner closures.** This ensures they share the same mock instances as the rest of the plugin code.

```typescript
// CORRECT: inner closure — shares mock instances with plugin body
export const myPlugin: Plugin = async ({ client }) => {
  async function sendResults(outcomes, sessionID) {
    await sendMessage({ client, sessionId: sessionID, message: "result" })
    // ↑ same mock instance as the rest of the plugin
  }
  // ...
}
```

### Safe for Module Level

Pure functions that do NOT call mocked imports are safe to define at module level:

```typescript
// SAFE: pure function, no mocked imports
function extractFilePath(output: unknown): string | undefined {
  const args = (output as { args?: { filePath?: string } })?.args
  return typeof args?.filePath === "string" ? args.filePath : undefined
}

// SAFE: only uses non-mocked utility
function findMatchingGates(gates: GateConfig[], filePath: string): GateConfig[] {
  return gates.filter((g) => g.patterns.some((p) => isGlobMatch(p, filePath)))
}
```

### If Lint Complains

If a linter rule (e.g., `unicorn/consistent-function-scoping`) tells you to move an inner function to the outer scope, add an eslint-disable comment with an explanation:

```typescript
// eslint-disable-next-line unicorn/consistent-function-scoping -- must be inner closure: sendMessage is mocked in tests
async function sendTransitionMessage(...) { ... }
```
