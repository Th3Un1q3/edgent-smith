# Refactoring Meta-Lessons

Process-level insights from conducting a multi-file refactoring across the OpenCode plugin ecosystem.

## 1. File-Affinity Batching Beats Task-Affinity Batching

Launching subagents by task (e.g., "fix all logger calls") causes conflicts when multiple tasks touch the same file. Instead, batch by file: launch one subagent per file with ALL changes needed for that file. This:
- Eliminates coordination overhead for the orchestrator
- Avoids merge conflicts between subagent outputs
- Makes validation simpler (one output to verify per file)

## 2. Wide-Signature Helpers Cost Upfront

Changing a helper's signature (like adding a `pluginId` parameter to `log()`) has a predictable cost: every `toHaveBeenCalledWith` assertion in every test file must be updated. Factor this into effort estimates BEFORE starting — count call sites and test assertions first.

## 3. Parallel Subagents Require Dependency Mapping

Before launching parallel subagents, map the file dependency graph:
- Which files import from which?
- Which changes would cause cascading type errors?
- Which test files assert on the changed behavior?

Without this mapping, parallel execution creates cascading failures that are harder to debug than sequential ones.

## 4. Always Run Quality Gates Mid-Refactoring

Validation gates (`just typecheck`, `just lint`, `just test`) should be run after every 2-3 file changes, not just at the end. This surfaces regressions when they're small and locally contained, rather than accumulating 52 failures across 3 categories.

## 5. Dead Code Removal Is Never Just "One Method"

The dead-code removal cascade lesson — including the mock-factory dependency chain example — is documented in mem:refactoring/side-effect-cascades.