---
name: tdd-enforcement
description: "Strict RED→GREEN→REFACTOR TDD for every implementation change, feature, or bugfix, with debug-artifact cleanup before the final gates."
applyTo: "**/*.{ts,js,py}"
excludePaths: "**/*.test.ts,tests/*.py"
excludeAgents: "rug"
---

# TDD Enforcement

Load the `test-driven-development` skill's `SKILL.md` before editing implementation code; it carries the Iron Law, the RED → GREEN → REFACTOR cycle, the rollback sequence, the completion checklist, and the debug-artifact cleanup in its `## Debug artifact cleanup` section.

Edit-time boundaries for an implementation file:

- Do not change implementation code until a failing test exists; if you already did, discard the change and start from the test.
- A change spanning modules needs a test that crosses the same boundary.
- Run tests through `just` targets, never raw runners (`test-driven-development/references/running-tests-commands.md`).
