# Testing Anti-Patterns: Mocks

**Load this reference when:** writing or changing tests, adding mocks, or tempted to assert on or over-specify a mock.

Tests must verify real behavior, not mock behavior. Mocks isolate dependencies; they are never the thing under test.

**Core principle:** Test what the code does, not what the mocks do.

## The Iron Laws

```text
1. NEVER test mock behavior
2. NEVER mock without understanding dependencies
3. NEVER ship partial mocks
```

## Testing Mock Behavior

**The violation:**

```typescript
test('renders sidebar', () => {
  render(<Page />);
  expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument(); // tests the mock
});
```

**Why it is wrong:** you verify the mock works, so the test passes when the mock is present and fails when it is not — it says nothing about real behavior. Your human partner asks: "Are we testing the behavior of a mock?"

**The fix:**

```typescript
test('renders sidebar', () => {
  render(<Page />); // don't mock sidebar
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});
```

```text
BEFORE asserting on a mock element:
  Ask: "Am I testing real behavior or mock existence?"
  IF mock existence: STOP - unmock or delete the assertion; test real behavior.
```

## Mocking Without Understanding

**The violation:**

```typescript
// Mock prevents the config write this test depends on
vi.mock('ToolCatalog', () => ({
  discoverAndCacheTools: vi.fn().mockResolvedValue(undefined),
}));
await addServer(config);
await addServer(config); // should throw - but won't
```

**Why it is wrong:** the mocked method had a side effect the test depends on, so over-mocking for safety breaks real behavior or makes the test pass for the wrong reason.

**The fix:** mock the slow or external operation, not the high-level method the test depends on.

```text
BEFORE mocking any method:
  1. What side effects does the real method have?
  2. Does this test depend on any of them?
  3. Do I fully understand what the test needs?
  IF yes to side effects: mock the slow/external operation, not the high-level method.
  IF unsure: run against the real implementation first, observe, then mock minimally.
```

## Incomplete Mocks

**The violation:**

```typescript
const mockResponse = {
  status: 'success',
  data: { userId: '123', name: 'Alice' },
  // Missing metadata that downstream code uses
};
```

**Why it is wrong:** partial mocks hide structural assumptions and fail silently when downstream code reads an omitted field; the test passes while integration breaks.

**The fix:** mirror the complete real structure, including every field the system might consume downstream.

```text
BEFORE creating mock responses:
  Examine the actual response schema from docs or examples.
  Include ALL documented fields.
  Partial mocks fail silently when code depends on omitted fields.
```

## When Mocks Become Too Complex

Warning signs: mock setup longer than the test; mocking everything to force a pass; mocks missing methods the real component has; the test breaks whenever the mock changes.

Consider integration tests with real components — often simpler than a deep mock tree. Ask: "Do we need a mock here at all?"

## Red Flags

- Assertions check for `*-mock` test IDs.
- Methods are only ever called from test files.
- Mock setup is more than half the test.
- The test fails when you remove the mock.
- You cannot explain why the mock is needed, or you mocked "just to be safe".

## The Bottom Line

Mocks are tools to isolate, not things to test. If TDD reveals you are testing mock behavior, fix it: test real behavior or question why you are mocking at all.
