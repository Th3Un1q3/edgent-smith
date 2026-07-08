# Workflow: Modify Existing Tests vs Create New Ones

When adding behavior to code that already has tests, decide whether to extend an existing test file or create a new one. This decision affects test organization and maintainability.

## Decision Flow

### Step 1: Check for related test files

Look for existing test files covering the same module, class, feature area, or domain concept:

```bash
# Look for tests related to the subject
find . -name "*.test.*" -o -name "test_*.py" | grep -i "<subject_name>"
ls <module_directory>/tests/ 2>/dev/null || echo "No test directory found"
```

### Step 2: Apply the decision rules

| Situation | Action | Reasoning |
|---|---|---|
| Existing test file covers **same module/class** with tests for related behavior | **Extend existing file** — add new `describe`/`context`/`group` block or test cases within it | Tests live near their subject; one source of truth per unit |
| Existing test file is for a **different** module but shares domain concept (e.g., auth tests for email validation) | **Extend existing file** with clearly separated test group | Co-located domain behavior stays together |
| No related test files exist, or the new feature is in a **new module** | **Create new test file** following scaffold workflow | New subject gets its own test suite from scratch |
| Existing test file is massive (>500 tests) and unorganized | **Create new test file** — split by concern rather than enlarging an unwieldy file | Test file size indicates structural problem; fix it by splitting, not merging |
| Bug fix in code with no existing tests | **Create new test file** for the regression + any other uncovered behavior | Don't force unrelated behavior into a single-purpose regression test |

### Step 3: Verify your decision

```
BEFORE proceeding with implementation:
  Asked: "Does this test belong where it will be written?"

  Check:
    - Is it near the code it tests? ✓
    - Does it group logically with similar tests? ✓
    - Will future developers find it here? ✓
    - Am I not forcing unrelated behavior into a single file? ✓

  IF any answer is no → reconsider placement.
```

## Examples

### Scenario 1: Extend existing suite (correct)

```
Subject: Email validation in user-registration module
Existing test file: tests/test_user_registration.py (covers registration flow, email uniqueness)
New behavior: Reject emails with invalid domain format
Decision: ✅ Extend tests/test_user_registration.py with new test_group for domain validation
```

### Scenario 2: Create new suite (correct)

```
Subject: Payment processing — a new module with no tests yet
Existing test files: tests/test_billing.py, tests/test_invoicing.py
New behavior: Process credit card payments with PCI compliance checks
Decision: ✅ Create tests/test_payment_processing.py from scratch using scaffold workflow
```

### Scenario 3: Split massive suite (correct)

```
Subject: Auth module — tests/test_auth.py has 800+ test cases, no organization
New behavior: Add OAuth2 token refresh logic
Decision: ✅ Create tests/test_oauth_token_refresh.py — do not add to the bloated auth file
```

## When You Must Decide Quickly

If you cannot find any related test files and are uncertain, default to **creating a new test file**. It is always correct to start fresh for an untested module. You can merge later if tests grow unwieldy — splitting first avoids compounding organizational debt.
