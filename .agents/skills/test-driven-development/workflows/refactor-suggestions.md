# Workflow: Refactoring Suggestions for TDD Test Suites

After completing a full Red-Green-Refactor cycle or finishing all test cases, apply these refactoring patterns to improve both subject code and test suite maintainability.

## When to Apply These Suggestions

- After completing one full Red-Green-Refactor cycle (within the REFACTOR step)
- After finishing all tests from a scaffold — do a final pass over both test file and subject code together
- Periodically during large TDD sessions — don't accumulate refactoring debt

## 1. Find Duplicates

### In Subject Code

Look for repeated logic patterns that should be extracted:

```typescript
// ❌ DUPLICATE validation scattered across functions
function validateEmail(data) { if (!data.email || !data.email.includes('@')) return false; }
function validateUsername(data) { if (!data.username || data.username.length < 3) return false; }

// ✅ EXTRACT shared pattern
function notEmpty(value, minLength = 0) { return value && String(value).trim().length >= minLength; }
```

### In Test Code

Look for repeated test setup, fixtures, or assertions:

```typescript
// ❌ DUPLICATE setup in every test
test('rejects empty email', async () => {
  const mockDb = new Database(); // same setup everywhere
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});

test('rejects null name', async () => {
  const mockDb = new Database(); // duplicate!
  const result = await submitForm({ name: null });
  expect(result.error).toBe('Name required');
});

// ✅ EXTRACT shared setup into beforeEach / fixture builder
describe('submitForm validation', () => {
  let db;
  
  beforeEach(() => {
    db = new Database(); // runs before each test — once defined, used everywhere
  });

  test('rejects empty email', async () => { ... });
  test('rejects null name', async () => { ... });
});
```

### Gate: Duplicate Detection

```
Scan every file for:
  - Identical or near-identical code blocks (>5 lines) in subject
  - Repeated test setup appearing in >2 tests
  - Identical assertion patterns across multiple tests

For each duplicate found:
  1. Extract to shared function / helper / fixture
  2. Verify all tests still pass after extraction
  3. Do not leave the duplicate "for readability" — extract it
```

## 2. Find Already Existing Functionality

Before writing new subject code, check if existing utilities already handle part of the requirement:

### In Subject Code

```typescript
// Before implementing validation from scratch:
// Check: does the project already have a shared validator?
// ls node_modules/ | grep -i "validator"
# or search project imports for utility modules

// If exists → use it. Don't rewrite.
// Only write new code when existing utilities don't cover your case.
```

### In Test Code

Check for existing test helpers, fixtures, and mock builders:

```typescript
// ❌ Writing custom setup every time
function createMockUser() {
  return { id: '1', name: 'Test User', email: 'test@example.com', role: 'admin' };
}

// ✅ Check if a shared test fixture already exists
import { mockUsers } from '@/test/fixtures/users'; // might already exist!

// If no shared fixture exists → create one and put it in the project's test utilities
```

### Gate: Existing Functionality Scan

```
BEFORE writing any new production code or test helper:
  1. Search imports / dependencies for existing utility covering this concern
  2. Check project's test fixtures directory for related shared data
  3. Ask: "What already exists that handles part of this?"

  IF something found → use it, extend it, or report why it doesn't fit
  IF nothing found → proceed with implementation from scratch
  
  Never rewrite existing functionality without explicit reason (API change, bug fix, etc.)
```

## 3. Group Test Cases for Readability and Maintainability

Organize tests so that related behavior lives together and the test file reads like documentation:

### Group by Behavior, Not by Method Name

```typescript
// ❌ BAD — grouped by the method being tested (too mechanical)
describe('validate', () => {
  test('validates email field');
  test('validates name field');
  test('validates phone field');
});

// ✅ GOOD — grouped by user-facing behavior
describe('form validation errors', () => {
  context('when required fields are missing', () => {
    test('rejects submission with empty email');
    test('rejects submission with empty name');
    test('rejects submission with empty phone');
  });

  context('when invalid data is provided', () => {
    test('rejects malformed email addresses');
    test('rejects non-numeric phone numbers');
  });
});
```

### Group by Input Domain or Scenario

```typescript
// For API testing — group by endpoint and scenario
describe('POST /users', () => {
  context('happy path', () => { ... });
  context('validation failures', () => { ... });
  context('duplicate detection', () => { ... });
  context('authorization errors', () => { ... });
});

// For state machines — group by transition
describe('order lifecycle', () => {
  context('transitioning from created to paid', () => { ... });
  context('transitioning from paid to shipped', () => { ... });
  context('invalid transitions (error cases)', () => { ... });
});
```

### Use Descriptive Nesting Levels

Keep nesting shallow — two or three levels maximum:

```typescript
// ✅ CLEAR — each level adds meaningful context
describe('email validation', () => {
  context('valid addresses', () => {
    test('accepts standard email format');
    test('accepts plus-addressed emails');
  });
  
  context('invalid addresses', () => {
    test('rejects missing @ symbol');
    test('rejects missing domain');
  });
});

// ❌ TOO DEEP — nesting obscures the test intent
describe('email', () => {
  describe('validation', () => {
    describe('format checks', () => {
      describe('missing parts', () => {
        describe('@ symbol', () => {
          test('...'); // buried!
        });
      });
    });
  });
});
```

### Group by Test Data Variations (Parameterized Tests)

When tests differ only in input data, group them into parameterized or data-driven tests:

```typescript
// ❌ SEPARATE — each variation is its own test (repetitive)
test('rejects empty string');
test('rejects whitespace-only string');
test('rejects null');
test('rejects undefined');

// ✅ GROUPED — single parameterized test covering all invalid inputs
test.each([
  ['', 'empty string'],
  ['   ', 'whitespace only'],
  [null, 'null value'],
  [undefined, 'undefined value'],
])('rejects invalid input: %s (%s)', (input, description) => { ... });
```

## 4. Cross-Cutting Refactoring Suggestions

Beyond the three main patterns above, consider these during any refactoring pass:

### Extract Shared Test Helpers

When you find yourself writing the same test setup or assertion more than twice, extract it:

```typescript
// After spotting repetition across tests:
// Create a shared builder in your test utilities directory
export function buildFormData(overrides = {}) {
  return { 
    email: 'test@example.com', 
    name: 'Test User', 
    ...overrides 
  };
}
```

### Reduce Test Coupling to Implementation Details

Tests should verify behavior, not how the code is structured internally:

```typescript
// ❌ Tests implementation — fragile when structure changes
test('calls validateEmail twice during form submission'); // broken if you refactor!

// ✅ Tests behavior — stable across refactoring
test('rejects form with invalid email address'); // still passes after any refactor
```

### Consolidate Overlapping Test Files

During your scan for grouping opportunities, note test files that cover the same domain concept and should be merged:

```
Example finding: tests/test_email_validation.py covers email checks used across 
multiple modules. Merge into a single source of truth rather than duplicating 
validation tests in tests/test_registration.py and tests/test_login.py.
```

## Refactoring Gate

```
After completing refactoring pass:
  Run full test suite — all must stay green
  
  Check every change against these criteria:
    - Did I remove duplication? ✓ (subject or test code)
    - Did I find existing functionality I should have used? ✓
    - Are tests grouped by behavior, not implementation? ✓
    - Is the test file readable as documentation? ✓
    - Do all tests still pass after refactoring? ✓
  
  IF any answer is no → revert that specific change and fix it.
```
