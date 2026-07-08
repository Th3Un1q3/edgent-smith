# Workflow: Implement Tests One at a Time

Execute the Red-Green-Refactor cycle for each test case individually. Never implement multiple tests or their subject code together — complete one full cycle per iteration before moving to the next.

## When to Use This Workflow

- A scaffold file exists (from [scaffold.md](./scaffold.md)) and you are ready to implement
- You need to add a single new test case to an existing suite
- Any time you write production code — there must be exactly one failing test driving it

**Do not use this when:** deciding whether tests should go in an existing file or a new one — see [modify-existing.md](./modify-existing.md) first.

## The Cycle (per test case)

### Step 1: RED — Write One Failing Test

Implement exactly **one** test stub from the scaffold as real code. It must be minimal and specific:

- Tests one behavior only
- Has a descriptive name stating what is verified
- Uses real inputs (no mocks unless unavoidable)
- Contains clear assertions on expected output/errors/state

```typescript
// ✅ GOOD — one behavior, real inputs
test('rejects empty email', async () => {
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});

// ❌ BAD — tests multiple things at once
test('validates form completely', async () => {
  // Tests email, name, phone, address...
});
```

### Step 2: Verify RED — Watch It Fail

Run **only** this test file (or this specific test):

Read the appropriate commands from [running-tests-commands.md](../references/running-tests-commands.md). Do not guess; always read the reference first.

Confirm all three conditions:
1. Test fails (not errors) — a failed assertion, not an exception
2. Failure message matches what you expect
3. It fails **because the feature is missing** — not due to typos, wrong imports, or setup issues

**If test passes?** You are testing existing behavior, not new behavior. Revise your test to target unimplemented functionality.

**If test errors (not fails)?** Fix the error, re-run until it fails correctly for the right reason.

### Step 3: GREEN — Write Minimal Code

Implement **only** enough production code to make this single test pass. No features, no refactoring of existing code, no "just in case" logic.

```typescript
// ✅ GOOD — just enough
function submitForm(data) {
  if (!data.email?.trim()) {
    return { error: 'Email required' };
  }
}

// ❌ BAD — wrote validation for name, phone, address too
// YAGNI — only the test asked for email validation
```

### Step 4: Verify GREEN — Watch It Pass

Run the full suite to confirm:
1. The new test passes
2. All existing tests still pass (no regressions)
3. Output is clean (no errors, no warnings)

**If any other test fails?** Fix it immediately. This means your change broke something.

### Step 5: REFACTOR — Clean Up

With all tests green, refactor both subject code and the new test:
- Remove duplication in subject code or test helpers
- Improve naming for clarity
- Extract repeated setup into shared helpers
- Simplify complex assertions

**Constraint:** Do not add behavior. Every line of refactoring must make existing code clearer or more maintainable — never introduce new functionality.

Run full suite after refactoring to stay green:

Read run commands from [running-tests-commands.md](../references/running-tests-commands.md). Do not guess; always read the reference first.

## Gate Function

```
AFTER each cycle completes:
  Can I check every box on the verification checklist?
    - Test failed first for right reason ✓
    - Minimal code written ✓
    - All tests pass ✓
    - Output clean ✓

  IF any answer is no → stop. Fix before proceeding to next test.

  Proceed to next test stub from scaffold. Repeat cycle.
```

## When Stuck

| Problem | Solution |
|---|---|
| Don't know how to write the test | Write the wished-for API first, then assert on it. Ask your human partner. |
| Test setup is complicated | Extract helpers. Still complex? The design may need simplifying. |
| Must mock everything | Code is too coupled. Use dependency injection instead of mocking internals. |
| Huge test fixtures | Extract shared builders/factories. If still large, the interface may be overcomplicated. |

## Progression Through Test Suite

1. Pick **one** stub from scaffold (any order)
2. Execute RED → Verify RED → GREEN → Verify GREEN → REFACTOR cycle above
3. Check that it's done against the verification checklist
4. Move to next stub — repeat until all are implemented and passing

Never skip a test case because "it seems obvious." Every line of production code must be driven by a failing test.

## Fixture & Mock Data

### Inline Fixture Files for Parsers

Tests that parse files **must create their own inline fixture data** — never rely on existing files in `.github/` or elsewhere that may not exist in every test environment. Choose one of:

- `vi.mock('bun')` / `vi.mock('bun:fs')` with `vi.doMock` for fine-grained, per-test control
- Write temp fixture files in `beforeEach`, clean up in `afterEach` when the production API requires real paths

```typescript
// ✅ GOOD — inline fixture via vi.mock + bun fs
import * as bunFs from 'bun:fs';

vi.mock('bun:fs', async () => {
  const actual = await vi.importActual<typeof bunFs>('bun:fs');
  return {
    ...actual,
    readFileSync: vi.fn((path) => {
      if (String(path).includes('.yml')) {
        return '---\ntitle: My Doc\n---\nbody content';
      }
      return actual.readFileSync!(path);
    }),
  };
});

test('parses yaml front matter', () => {
  const result = parseDoc('/some/file.yml');
  expect(result.frontMatter.title).toBe('My Doc');
});
```

```typescript
// ✅ GOOD — temp files in hooks when real paths are required
import fs from 'node:fs';
import os from 'node:path';
import { mkdtemp } from 'mktempdir'; // or equivalent

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

test('reads yaml front matter from real file', () => {
  const fixturePath = `${tmpDir}/doc.yml`;
  fs.writeFileSync(fixturePath, '---\ntitle: Fixture Doc\n---\nbody');
  const result = parseDoc(fixturePath);
  expect(result.frontMatter.title).toBe('Fixture Doc');
});
```

### Mocking `bun` Glob

When production code uses `Glob` from `bun`, tests **must mock it to return predictable file lists**. Do NOT depend on real filesystem paths under `.github/` or any external directory that may not exist in every test environment.

```typescript
import { expect, vi } from 'vitest';

vi.mock('bun', async () => {
  const actual = await vi.importActual<typeof import('bun')>('bun');
  return {
    ...actual,
    Glob: vi.fn((pattern) => ({
      [Symbol.asyncIterator]: () => {
        const files = pattern.includes('*.yml')
          ? ['/tmp/docs/a.yml', '/tmp/docs/b.yml']
          : [];
        let idx = 0;
        return {
          next: () => (idx < files.length ? { value: files[idx++], done: false } : { done: true }),
        };
      },
    })),
  };
});

test('processes all yaml files from glob', async () => {
  const result = await processDocs();
  expect(result.files).toEqual(['/tmp/docs/a.yml', '/tmp/docs/b.yml']);
});
```

### Summary Rules

- Tests that parse files **must** create their own inline fixture data — never depend on pre-existing external files.
- When the production code uses `Glob` from bun, mock it to return predictable file lists — do NOT depend on real filesystem paths under `.github/` or elsewhere that may not exist in every test environment.
