# Testing Anti-Patterns: Test Lifecycle

**Load this reference when:** production code carries test-only helpers, or tests are treated as a follow-up after implementation.

These anti-patterns come from where tests sit in the development lifecycle, not from mocking.

## Test-Only Methods in Production

**The violation:**

```typescript
class Session {
  async destroy() { // only tests call this
    await this._workspaceManager?.destroyWorkspace(this.id);
  }
}
afterEach(() => session.destroy());
```

**Why it is wrong:** production code is polluted with test-only API, dangerous if called for real, and conflates object lifecycle with entity lifecycle.

**The fix:** keep the class stateless and move cleanup into a test utility.

```typescript
// test-utils/
export async function cleanupSession(session: Session) {
  const workspace = session.getWorkspaceInfo();
  if (workspace) await workspaceManager.destroyWorkspace(workspace.id);
}
afterEach(() => cleanupSession(session));
```

```text
BEFORE adding any method to a production class:
  Ask: "Is this only used by tests?"  IF yes: STOP - put it in test utilities.
  Ask: "Does this class own this resource's lifecycle?"  IF no: STOP - wrong class.
```

## Integration Tests as Afterthought

**The violation:**

```text
✅ Implementation complete
❌ No tests written
"Ready for testing"
```

**Why it is wrong:** testing is part of implementation, not an optional follow-up. TDD would have caught it, and "complete" is unclaimable without tests.

**The fix:** run the TDD cycle — write a failing test, implement to pass, refactor — then claim complete.

## TDD Prevents These Anti-Patterns

1. **Write test first** — forces you to decide what you are actually testing.
2. **Watch it fail** — confirms the test exercises real behavior, not mocks.
3. **Minimal implementation** — stops test-only methods creeping in.
4. **Real dependencies** — shows what the test needs before you mock.

If you are testing mock behavior, you violated TDD: you added mocks without watching the test fail against real code first.

## Quick Reference

| Anti-pattern | Fix |
|---|---|
| Assert on mock elements | Test the real component or unmock it |
| Test-only methods in production | Move to test utilities |
| Mock without understanding | Understand dependencies first, mock minimally |
| Incomplete mocks | Mirror the real API completely |
| Tests as afterthought | Run the TDD cycle — tests first |
| Over-complex mocks | Consider integration tests |
