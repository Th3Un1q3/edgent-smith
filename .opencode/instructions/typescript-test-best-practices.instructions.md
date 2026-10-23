---
name: typescript-test-best-practices
description: "Best practices on designing tests in TypeScript."
applyTo: ".opencode/plugins/tests/**/*.test.ts"
excludeAgents: "rug"
---

# TypeScript test design

Load `test-design/SKILL.md` and its `references/typescript-conventions.md` before editing a test file; they carry the test design criteria and the TypeScript conventions for mocking, assertions, and test structure.

Edit-time boundary: test files in this tree import through the `@plugins/*` and `@tests/*` aliases declared in `.opencode/tsconfig.json`, never through relative paths out of the test tree.
