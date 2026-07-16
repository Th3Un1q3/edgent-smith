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
