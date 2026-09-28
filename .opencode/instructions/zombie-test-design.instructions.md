---
name: zombie-test-design
description: "ZOMBIES mnemonic for choosing and ordering test cases incrementally, from the Zero case upward, when designing a new feature or bugfix test suite."
applyTo: "{tests/*.py,**/*.test.ts}"
excludeAgents: "rug"
---

# ZOMBIES: Incremental Test Design

When starting a new feature or fixing a bug, design test cases incrementally from the simplest case upward. The ZOMBIES mnemonic — Zero, One, Many, Boundary, Interface, Exceptional, Simple — and its ordering are documented in the `test-driven-development` skill's `references/zombie-test-design.md`; load that reference for the full guidance.
