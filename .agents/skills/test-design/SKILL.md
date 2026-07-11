---
name: test-design
description: >
  Create and modify test cases across the codebase for all supported languages. Use this skill when writing new tests, modifying existing ones, establishing testing patterns, or reviewing test quality — especially when the user mentions test files, mocking, assertions, table-driven tests, test structure, organizing specs, or adding coverage. Also use when the user asks to write unit/integration/e2e tests, fix flaky tests, establish test conventions, or review existing test code for correctness and style. Triggers on Python and TypeScript projects alike — read general-principles.md for rules, then pick the language-specific example file (python-conventions.md or typescript-conventions.md) that matches your project.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  author: edgent-smith team
---

# Test Design Skill

Provides language-agnostic testing principles and concrete, per-language examples for Python and TypeScript projects in the edgent-smith codebase.

## When to Use This Skill

Invoke this skill when:
- Writing new tests or modifying existing ones (Python or TypeScript)
- Establishing testing conventions (mocking, table-driven tests, test organization)
- Reviewing test quality or fixing flaky tests
- The user mentions test files, mocking patterns, assertions, table-driven tests, organizing specs, or adding coverage

## When Not to Use This Skill

Do not use this skill for:
- Writing production application code outside of test files
- End-to-end browser automation (use playwright/puppeteer workflows)
- Performance benchmarking or load testing

## General Principles

All rules live in [references/general-principles.md](./references/general-principles.md). Read that file first — it defines every principle including the core pattern: **configure mock behavior in shared hooks (`beforeEach` for vitest / `@patch` decorators or fixtures for pytest), then override per-scenario via nested contexts** (nested describe blocks with their own `beforeEach` for TypeScript, class inheritance or scenario fixtures for Python). Then pick the language-specific example file that matches your project.

## Task Routing Table

Load only the files relevant to the current task.

| I want to... | File |
|---|---|
| Understand what principles to apply to test design (language-agnostic) | [references/general-principles.md](./references/general-principles.md) |
| Learn what TypeScript specific conventions to follow | [references/typescript-conventions.md](./references/typescript-conventions.md) |

## High-Quality Test Checklist

- [ ] Test file is scoped to a single module under test (one test per one tested file)
- [ ] Test file is within 150% of the subject size maximum (e.g., 200 lines of code → 300 lines of test code). Some exceptions allowed in [general-principles.md](./references/general-principles.md) for complex modules, but avoid exceeding this limit.
- [ ] Test case names are descriptive and clearly indicate the expected behavior being tested
- [ ] All setup and teardown logic is centralized in shared hooks (e.g., `beforeEach` for vitest, `@patch` decorators or fixtures for pytest)
- [ ] Every test case is independent and does not rely on the state or order of other tests
- [ ] Every test case tests a single behavior or scenario; avoid multiple assertions that test different behaviors in one test case
- [ ] Test follows the language-specific conventions for the project (e.g., TypeScript or Python)
- [ ] Test passes, and any failures are reproducible and clearly indicate the cause of failure
- [ ] Test file has no linter or type errors, and adheres to the project's coding standards 
- [ ] Test covers all the code branches and edge cases for the module under test, including error handling and boundary conditions for module under test

When to apply this checklist:
- When evaluating if existing tests are well-designed and maintainable
- When reviewing new tests for correctness and style
- When designing new tests to ensure they meet quality standards

## Related Skills

- `building-modular-skills`
- `python-testing-patterns`
- `vitest`
