# Running Multi-File Refactoring Sessions

Process guidance for running a multi-file refactoring across a plugin codebase: batch subagent work by file, map the dependency graph, forecast signature-change costs, and keep the change green with mid-refactoring quality gates.

## Batching and Dependencies

- **Batch by file, not by task**: launch one subagent per file with ALL of its changes rather than one subagent per task. This avoids coordination overhead and merge conflicts between subagent outputs, and leaves one artifact to verify per file.
- **Map the dependency graph before going parallel**: know which files import which, which changes cause cascading type errors, and which tests assert on the changed behavior. Without this mapping, parallel execution creates cascading failures that are harder to debug than sequential ones.

## Cost Forecasting

- **Wide-signature helpers cost upfront**: changing a shared helper signature forces every assertion that checks its arguments (e.g., `toHaveBeenCalledWith`) to be updated. Count call sites and test assertions before starting, and factor that into effort estimates.
- **API switches orphan constants**: after moving off an API, grep for constants and comments referencing the removed API and delete them in the same refactor.

## Keeping the Change Green

- **Run quality gates mid-refactoring**: run typecheck, lint, and tests after every few file changes so regressions surface while locally contained, rather than accumulating failures across categories at the end.
- **Typed API surface ≠ runtime dispatch**: verify hook dispatch with runtime logs rather than trusting the type surface — see mem:refactoring/permission-hooks.
- **Dead-code removal cascades**: removing one method can break a mock-factory chain — see mem:refactoring/side-effect-cascades.