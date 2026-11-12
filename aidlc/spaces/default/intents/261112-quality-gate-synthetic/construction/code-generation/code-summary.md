# Code Summary

## Files created

- `.opencode/plugins/helpers/tool-input.ts` — `readFilePath` (prefers `path`, falls back to a non-empty `filePath`) and `relativeTo` (workspace-relative conversion), shared by both plugins.
- `.opencode/plugins/helpers/steering-message.ts` — `SteeringAttributes` and the shared `buildSteeringMessage` (attributes + body, or body only with the instruction defaults).
- `.opencode/plugins/tests/helpers/tool-input.test.ts` — path extraction and relative conversion cases.
- `.opencode/plugins/tests/helpers/steering-message.test.ts` — attribute rendering, optional `result`/`gate-id`, and the body-only default.

## Files modified

- `.opencode/plugins/quality-gate-enforcer.ts` — gate signals now go out through `session.synthetic` in one append per hook run, with `metadata: { quality_gate, transition }` and no message id; a failed append is logged as a warning and the hook continues; local path helpers replaced by the shared module.
- `.opencode/plugins/instructions-loader.ts` — local `readFilePath` replaced by the shared import.
- `.opencode/plugins/helpers/instruction-payload.ts` — re-exports the shared `buildSteeringMessage`; the local wrapper is gone.
- `.opencode/plugins/helpers/gate-formatter.ts` — builds the steering wrapper through the shared builder; `formatGateFailure` removed.
- `.opencode/plugins/helpers/gate-runner.ts` — `createDirtyGateBatcher` and `DirtyGateBatcher` removed.
- `.opencode/plugins/helpers/gate-config.ts` — no longer returns `debounceMs`.
- `.opencode/plugins/types/quality-gate.ts` — `GateKVState`, `GateStateEntry`, and `debounceMs` removed.
- `.opencode/plugins/config/harness.config.ts` — `debounceMs: 1500` removed from the enforcer section.
- `.opencode/plugins/tests/quality-gate-enforcer.test.ts` — harness captures synthetic appends; cases assert pre-change and post-change synthetics, no prompt calls, unchanged-status silence, metadata, and warn-and-continue on a rejected append.
- `.opencode/plugins/tests/helpers/gate-formatter.test.ts`, `tests/helpers/gate-runner.test.ts`, `tests/helpers/instruction-payload.test.ts`, `tests/instructions-loader.test.ts`, `tests/types/quality-gate.test.ts`, `tests/helpers/gate-config.test.ts` — updated for the shared builder and the removals.

## Key implementation decisions

- **Batch per hook run.** One synthetic message carries every transition from one hook run, matching the existing `formatGateBatchResults` text; the pre-change and status-diff rules are unchanged.
- **Metadata, not ids.** The append carries the changed gate names and their transitions as `metadata`; no `id` is passed, because a session message id must start with `msg_`.
- **Body-only overload.** `buildSteeringMessage` keeps the one-argument instruction call sites working while the gate formatter passes explicit attributes; instruction defaults are `high` / `relevant files touched` / `instructions`.
- **Failure is advisory.** A rejected append is logged and the tool call resolves; the signal is not allowed to block an edit.

## Test coverage

- Scoped suite: 9 files, 110 tests, all passing.
- Full plugin suite with coverage: 40 files, 922 tests, all passing.
- Coverage: statements 97.69%, branches 93.26%, functions 97.33%, lines 98.33% (project-wide floor 90%).
- Lint: 0 errors, 1 pre-existing warning in `tests/helpers/instruction-indexer.test.ts` (`@typescript-eslint/no-non-null-assertion`).
- Typecheck: clean.

## Tests written but not executed

None. Every listed suite ran in this environment.

## Deviations from the plan

- The session was interrupted by a server restart after most of the build; the remaining work was the `gate-config.test.ts` debounce case and the `harness.config.ts` key, both part of FR4.3/FR4.4. The first scoped run after the restart passed 105 tests; after those two edits it passed 110.
- The plan's Step 1 baseline output was not captured before the restart. The first recorded scoped run is the post-change pass, so this summary does not claim a captured pre-change baseline.
- No `source-manifest.json`: zero-Unit work, as the plan states.
