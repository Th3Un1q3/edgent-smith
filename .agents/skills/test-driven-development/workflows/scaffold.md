# Workflow: Create Test Scaffold

Create **only a minimal scaffold** for new functionality — an empty `describe`/test block with the import boilerplate and a TODO comment listing what test cases *will* go inside. Do **not** write named test stubs, assertions, or case descriptions in the scaffold. You will fill each test case one at a time using [one-by-one.md](./workflows/one-by-one.md) afterward.

## When to Use This Workflow

- Starting tests for a feature that has no existing test file
- Adding a new module/class with TDD — create its test suite first
- Bug fix where the relevant code has no regression tests yet

**Do not use this when:** an existing test file already covers related behavior — see [modify-existing.md](./workflows/modify-existing.md) instead.

## Steps

### 1. Identify the subject under test

Determine what function, class, or module the new tests will exercise. Note its expected API surface: inputs, outputs, side effects, error conditions. List these mentally — do **not** write them into the scaffold file.

### 2. Write only a minimal scaffold file

Create a **new** test file with just:

- Required imports for the testing framework
- A `describe` block named after the subject under test
- A single TODO comment listing what categories of tests *will* go inside (for your reference only)
- No actual test cases, assertions, or stubs

**Scaffold format example:**

```typescript
import { describe, it } from 'vitest'
// import { subject } from '../path/to/subject'  // TODO: add imports once first test is written

describe('SubjectName', () => {
  // TODO: test cases to implement (one-by-one):
  //   - happy path / core behavior
  //   - boundary values (0, max, empty, null)
  //   - invalid inputs and error paths
  //   - edge cases (single-item, state transitions)
  it.todo('informative description of the first test case to implement')
});
```

**CRITICAL: Do NOT write individual test stubs with names or assertions. The scaffold is a blank `describe` block with a TODO comment only.**

### 3. Review the scaffold

Confirm it contains:
- Correct file path (mirrors subject location under test directory)
- `describe` block named after the subject
- TODO listing what will go inside (your reference, not implementation)
- No actual test cases or assertions

If you see individual `it()`/`test()` blocks with names — remove them. That is no longer a scaffold; that is an incomplete test suite.

### 4. Save the scaffold file and proceed

Write the scaffold to its final location. **Do not run it.** Proceed to [one-by-one.md](./workflows/one-by-one.md) to implement each test case and its subject code incrementally, one at a time.
