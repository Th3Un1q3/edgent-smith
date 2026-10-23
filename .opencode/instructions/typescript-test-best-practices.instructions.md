---
name: typescript-test-best-practices
description: "Best practices on designing tests in TypeScript."
applyTo: ".opencode/plugins/tests/**/*.test.ts"
excludeAgents: "rug"
---

# TypeScript test design

Test design criteria and the TypeScript conventions for mocking, assertions, and test structure are owned by the `test-design` skill: `SKILL.md` and `references/typescript-conventions.md`. Load both before editing a test file.

Edit-time boundary: test files in this tree import through the `@plugins/*` and `@tests/*` aliases declared in `.opencode/tsconfig.json`, never through relative paths out of the test tree.
