# Plugin Test Mock Patterns

Reusable patterns for mocking OpenCode plugin dependencies in Vitest. Focuses on SessionStorage mock infrastructure, phase-based TDD, and common hook-related pitfalls.

## Mock Infrastructure

- **SessionStorage mocking**: Use a mock factory pattern to create `MockSessionStorage` with shared state across tests. Pre-populate via a reset helper before each test.
- **Mock coverage**: Verify the mock factory exports every dependency the plugin imports. Missing exports cause silent init-time failures with no error output.

## TDD Phases for Plugins

| Phase | Focus |
|---|---|
| Foundation | Namespace isolation, no side effects to external systems, dispose cleanup, null state guards |
| Detection | Hook-based event detection (message parsing, tool execution tracking) |
| Counting + Threshold | Accumulation logic, strict threshold evaluation, persistence, idle-triggered actions |

Implement each phase fully before starting the next. Do not implement detection before foundation tests pass.

## Common Pitfalls

- **Hook guard surprises**: `tool.execute.before` returns early if no state exists. Tests must pre-populate mock state.
- **Test ordering bugs**: Real-world event sequence is prompt-first, then tool. Reversing this order breaks guard logic that rejects re-parsing when state already exists.
- **Mock factory gaps**: A mock factory that doesn't export every dependency will cause silent failures — verify coverage before starting TDD.

## Permission-Rejection Tests

Drive the `event` hook directly: dispatch a `permission.asked` payload (`{ type: 'permission.asked', properties: { id, sessionID } }`), then assert the reject method was called with the exact nested shape (`{ path: { id, permissionID }, body: { response: 'reject' } }`). Also assert it is NOT called for other event types and when the gate (flag file) is absent.

## References

- `mem:testing/mutation-scoping` — scoping mutation tests to changed modules
- `mem:testing/typescript/bun-apis-in-stryker-sandbox` — Bun API calls vulnerable in Stryker sandbox
- `mem:refactoring/plugin-lifecycle` — plugin hook lifecycle patterns
- mem:refactoring/permission-hooks — permission interception pitfalls