## Summary

- Builds: synthetic gate signals and the shared path/steering helpers both plugins use
- Touches: `.opencode/plugins/quality-gate-enforcer.ts`, `helpers/tool-input.ts` (new), `helpers/steering-message.ts` (new), `helpers/gate-formatter.ts`, `helpers/instruction-payload.ts`, `helpers/gate-runner.ts`, `types/quality-gate.ts`, and their tests
- Tests: one scoped Vitest case per behaviour (roughly 10–14 cases) under `.opencode/plugins/tests/`

## Testing Contract

```json
{
  "version": 1,
  "methodology": "tdd",
  "source": "team",
  "ordering": "failing test first per behaviour, then implementation; cross-module changes get a boundary test. (tdd-enforcement.instructions.md:15-16)",
  "scope": "refactor",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: tdd\n- **Methodology evidence**: — chosen because an implementation change is barred until a failing test exists. (tdd-enforcement.instructions.md:15)\n- **Ordering**: failing test first per behaviour, then implementation; cross-module changes get a boundary test. (tdd-enforcement.instructions.md:15-16)\n- No implementation change lands until a failing test exists. (tdd-enforcement.instructions.md:15)\n- Tests, lint and typecheck run only via `just`; raw `pytest`, `npm test`, `vitest`, `bun` and `tsc` are banned. (test-run-commands.instructions.md:27)\n- Per-file verification is mandatory before the next file; a file is not done until its check passes. (test-run-commands.instructions.md:35-37)\n- A unit test is deterministic and hermetic: no service, network, model call, env-var gate or skip. (live-verification.instructions.md:12)\n- GAP: no Python coverage floor exists; no `--cov` or `fail_under` in pyproject.toml or justfile, and coverage is gated only for TypeScript. (scripts/ci.sh:74)"
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "tdd",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - Red: write the failing tests and record the failing command output.",
      "Data model / database behavior - Green: implement only enough behavior to pass.",
      "Data model / database behavior - Refactor: improve the implementation while tests stay green.",
      "Repository / data access - Red: write the failing tests and record the failing command output.",
      "Repository / data access - Green: implement only enough behavior to pass.",
      "Repository / data access - Refactor: improve the implementation while tests stay green.",
      "Business logic - Red: write the failing tests and record the failing command output.",
      "Business logic - Green: implement only enough behavior to pass.",
      "Business logic - Refactor: improve the implementation while tests stay green.",
      "API / endpoint - Red: write the failing tests and record the failing command output.",
      "API / endpoint - Green: implement only enough behavior to pass.",
      "API / endpoint - Refactor: improve the implementation while tests stay green.",
      "Frontend behavior - Red: write the failing tests and record the failing command output.",
      "Frontend behavior - Green: implement only enough behavior to pass.",
      "Frontend behavior - Refactor: improve the implementation while tests stay green.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:ba51a28d77a94178a14891d9fa62f816dab0b696be08bda3e25c59e7143967ae",
  "contract_sha256": "sha256:eeefcd009bdd66e7471ea40e734daa583277dfc40a845f4b34d9edc0d67bfca5"
}
```

## Plan

Testable layers that do not apply here: there is no database, repository/data-access, API endpoint, or frontend surface. The applicable layers are the shared helper modules (business logic) and the plugin signal path (business logic), with the type definitions carried by the steps that change them. Each step names the requirement IDs it implements.

### Step 1 — Verify the test runner and record the baseline

- [x]Confirm `.opencode/vitest.config.ts`, `.opencode/tsconfig.json`, and the `test` recipe exist and resolve the `@plugins/*` and `@tests/*` aliases.
- [x]Run the scoped baseline and record its output in `code-summary.md`:
  `just .opencode/test -- plugins/tests/quality-gate-enforcer.test.ts plugins/tests/helpers/gate-formatter.test.ts plugins/tests/helpers/gate-runner.test.ts plugins/tests/types/quality-gate.test.ts plugins/tests/helpers/instruction-payload.test.ts plugins/tests/instructions-loader.test.ts`
- [x]Confirm the suite is green before any edit (brownfield test baseline).
- [x]Traceability: supports FR5.3 and NFR1.

### Step 2 — Path helpers — Red

- [x]Add `plugins/tests/helpers/tool-input.test.ts` with cases: `path` wins over `filePath`; `filePath` is used when `path` is absent; an empty `path` falls back to `filePath`; a non-string or absent pair yields `undefined`; `relativeTo` strips the workspace prefix; `relativeTo` leaves an external path unchanged.
- [x]Run `just .opencode/test -- plugins/tests/helpers/tool-input.test.ts` and record the failing output (module does not exist).
- [x]Traceability: FR3.1, FR3.2.

### Step 3 — Path helpers — Green

- [x]Add `plugins/helpers/tool-input.ts` exporting `readFilePath` and `relativeTo`.
- [x]Replace the local implementations in `quality-gate-enforcer.ts` and `instructions-loader.ts` with imports from `./helpers/tool-input`.
- [x]Re-run the Step 2 command; it passes.
- [x]Traceability: FR3.1, FR3.2, FR3.4.

### Step 4 — Path helpers — Refactor

- [x]Keep the Step 2 suite green; remove the now-unused local type aliases or casts in both entry points.
- [x]Run `just .opencode/typecheck` and record it green.
- [x]Traceability: FR3.4, NFR2.

### Step 5 — Steering builder — Red

- [x]Add `plugins/tests/helpers/steering-message.test.ts` with cases: explicit attributes render the opening tag with `priority`, `reason`, and `type`; `result` and `gateId` are emitted only when present; the body is wrapped with a leading and trailing newline; calling with a body only defaults to the instruction attributes (`high`, `relevant files touched`, `instructions`).
- [x]Run `just .opencode/test -- plugins/tests/helpers/steering-message.test.ts` and record the failing output.
- [x]Traceability: FR3.3, BR1.3.

### Step 6 — Steering builder — Green

- [x]Add `plugins/helpers/steering-message.ts` exporting `SteeringAttributes` and `buildSteeringMessage(attributes, body)`; make `attributes` optional with the instruction defaults.
- [x]Move the wrapper out of `instruction-payload.ts` and re-export `buildSteeringMessage` from it so existing call sites are unchanged.
- [x]Make `helpers/gate-formatter.ts` call the shared builder with gate attributes instead of composing the tag inline.
- [x]Re-run the Step 5 command; it passes, and `just .opencode/test -- plugins/tests/helpers/instruction-payload.test.ts plugins/tests/helpers/gate-formatter.test.ts` stays green.
- [x]Traceability: FR3.3, FR1.3.

### Step 7 — Steering builder — Refactor

- [x]Keep the builder tests green; remove any now-duplicated attribute assembly in `gate-formatter.ts`.
- [x]Run `just .opencode/lint` and record it green.
- [x]Traceability: NFR2.

### Step 8 — Synthetic delivery — Red

- [x]Update `plugins/tests/quality-gate-enforcer.test.ts` so the harness captures `synthetics` (sessionID, text, description, metadata) alongside `prompts`.
- [x]Add failing cases: a pre-change run of an unknown gate appends one synthetic and calls no prompt; a post-change transition appends one synthetic; an unchanged status appends nothing; the synthetic carries the gate name and the transition in `metadata` and no message `id`; a rejected append logs a warning and the hook still resolves.
- [x]Run `just .opencode/test -- plugins/tests/quality-gate-enforcer.test.ts` and record the failing output.
- [x]Traceability: FR1.1–FR1.4, FR2.1–FR2.3, FR6.1, BR5.1.

### Step 9 — Synthetic delivery — Green

- [x]Replace the `session.prompt({ resume: false })` calls in `quality-gate-enforcer.ts` with `session.synthetic({ sessionID, text, metadata })`; pass `metadata: { quality_gate: <gate name(s)>, transition: '<previous>-><new>' }` and no `id`.
- [x]Keep the status-diff rule and the pre-change skip rule unchanged; keep the existing message text.
- [x]Wrap the append so a failure is logged as a warning and the hook continues.
- [x]Re-run the Step 8 command; it passes.
- [x]Traceability: FR1.1–FR1.4, FR2.1–FR2.3, FR5.1, BR5.1.

### Step 10 — Synthetic delivery — Refactor

- [x]Keep the plugin suite green; remove the now-unused `prompts` capture if no other case needs it, and name the synthetic helper once.
- [x]Run `just .opencode/typecheck` and record it green.
- [x]Traceability: NFR2.

### Step 11 — Remove the dead surface — Refactor (tests stay green)

- [x]Delete `createDirtyGateBatcher` and `DirtyGateBatcher` from `helpers/gate-runner.ts`, and the batcher cases from `tests/helpers/gate-runner.test.ts`.
- [x]Delete `formatGateFailure` from `helpers/gate-formatter.ts`, and its cases from `tests/helpers/gate-formatter.test.ts`.
- [x]Delete `GateKVState` and `GateStateEntry` from `types/quality-gate.ts`, and the import/assertions from `tests/types/quality-gate.test.ts`.
- [x]Delete `debounceMs` from `QualityGatesConfig` and the `{ gates, debounceMs: 0 }` returns in the plugin tests.
- [x]Run the full scoped suite plus `just .opencode/typecheck`; both green.
- [x]Traceability: FR4.1–FR4.4.

### Step 12 — Full verification

- [x]Run `just .opencode/test -- plugins/tests/quality-gate-enforcer.test.ts plugins/tests/helpers/tool-input.test.ts plugins/tests/helpers/steering-message.test.ts plugins/tests/helpers/gate-formatter.test.ts plugins/tests/helpers/gate-runner.test.ts plugins/tests/helpers/instruction-payload.test.ts plugins/tests/instructions-loader.test.ts plugins/tests/types/quality-gate.test.ts` and record the pass count.
- [x]Run `just .opencode/lint` and `just .opencode/typecheck`; both green.
- [x]Run `just .opencode/test --coverage` for the project-wide floor and record the result; the 90% floor is judged on the full suite by Build and Test.
- [x]Traceability: FR5.1–FR5.3, NFR4.

## Notes

- No `source-manifest.json`: this is zero-Unit work.
- No application code outside `.opencode/plugins/`; the plan does not touch Python, CI, or the harness configuration file.
- The plugin id `opencode.quality-gate-enforcer` and the `gates` configuration key stay unchanged (C1).
