---
name: tdd-enforcement
description: "Strict RED→GREEN→REFACTOR TDD for every implementation change, feature, or bugfix, with debug-artifact cleanup before the final gates."
applyTo: "**/*.{ts,js,py}"
excludePaths: "**/*.test.ts,tests/*.py"
excludeAgents: "rug"
---

# TDD Enforcement

The Iron Law, the RED → GREEN → REFACTOR cycle, the rollback sequence, and the completion checklist are owned by the `test-driven-development` skill; load `SKILL.md` before editing implementation code. Debug-artifact cleanup is owned by that skill's `## Debug artifact cleanup` section.

Edit-time boundaries for an implementation file:

- Do not change implementation code until a failing test exists; if you already did, discard the change and start from the test.
- A change spanning modules needs a test that crosses the same boundary.
- Run tests through `just` targets, never raw runners (`test-driven-development/references/running-tests-commands.md`).
