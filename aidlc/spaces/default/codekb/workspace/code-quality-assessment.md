# Code Quality Assessment

## Summary

| Dimension | Rating | Basis |
|---|---|---|
| Naming clarity | good | Files and symbols state their job (`runGate`, `findMatchingGates`, `loadQualityGates`, `resolveInjectionCarrier`); a few short names are explained by adjacent comments (`statuses`, `gate`) |
| Function size | fair | `tool-limit-reminder.ts` (405 lines) and `goal-continuation.ts` (403 lines) each carry eight concerns in one `effect` closure; helpers are small and single-purpose |
| Error handling | good | Hooks wrap failure paths with `Effect.orDie`, `Effect.ignore`, `Effect.orElseSucceed`; gate timeouts are shaped into `{ exitCode: 124, timedOut: true }` instead of throwing |
| Test presence | good | Every production helper has a matching test file and a harness; type-only interfaces have `expectTypeOf` tests |
| Duplication | fair | Five helpers exist twice: path extraction, shell quoting, Bun template arrays, glob matching, idle-event predicate |
| Dead code | fair | `createDirtyGateBatcher`, `formatGateFailure`, `debounceMs`, `GateKVState`, `GateStateEntry` are exercised only by tests |

## Test Coverage

### Collection and thresholds

| Surface | Tool | Threshold | Evidence |
|---|---|---|---|
| TypeScript plugins | Vitest 4.1.11, Istanbul provider | 90% branches / functions / lines / statements | `.opencode/vitest.config.ts:38-51` |
| TypeScript plugins (in-editor gate) | Harness gate command | 85% branches / functions / lines / statements | `.opencode/plugins/config/harness.config.ts:26` |
| TypeScript mutation | Stryker 9.6.1 | break 72, low 60, high 80 | `.opencode/stryker.config.mjs:46-50` |
| Python | pytest | **none** — no `--cov`, no `fail_under` | `scripts/ci.sh:71`, `pyproject.toml:54-60` |

The 90% and 85% figures are both pinned by `scripts/verify_thresholds.sh:71-80`; the gate command restates a lower number than the config default, which is a documented compatibility point rather than an unguarded weakening.

### Test inventory for the quality-gate surface

| Test file | Covers |
|---|---|
| `.opencode/plugins/tests/quality-gate-enforcer.test.ts` (8 cases) | Pre-change transition, post-change transition, no-report on unchanged status, tool filtering, no-match path, multi-gate fan-out, per-session persistence, absolute-path matching |
| `.opencode/plugins/tests/helpers/gate-config.test.ts` | Section loading, gate-count floor, `debounceMs` default |
| `.opencode/plugins/tests/helpers/gate-runner.test.ts` | Command sequencing, timeout wrapper, `exitCode 124` mapping, shell quoting, dirty-gate batcher |
| `.opencode/plugins/tests/helpers/gate-formatter.test.ts` | Batch and single-gate rendering, stdout/stderr combination |
| `.opencode/plugins/tests/helpers/glob-match.test.ts` | Table-driven `isGlobMatch` cases |
| `.opencode/plugins/tests/types/quality-gate.test.ts` | `expectTypeOf` shape assertions for the type interfaces |

Plugin test infrastructure: `tests/helpers/{goal-continuation-harness,instructions-loader-harness,mock-utilities,repo-root}.ts`, `tests/__utils__/factories/client-factory.ts`, `tests/__mocks__/bun.ts`, `tests/vitest-bun-polyfill.setup.ts`, and `tests/fixtures/copilot-instructions/`.

Python: 27 files under `tests/`, including `test_cli_*` per command, `test_config.py`, `test_edge_agent.py`, `test_runner.py`, `test_experiment_storage.py`, and policy tests (`test_ci_workflow.py`, `test_verify_agents_integrity.py`, `test_task_runner.py`).

### Hermeticity

Unit tests are hermetic: plugin tests build a fake `Context`, mock `bun` under Node, and mock gate loading/execution (`quality-gate-enforcer.test.ts:7-11`). Python tests use `pydantic-ai`'s `TestModel` rather than a live model. The boundaries are documented in `.opencode/instructions/live-verification.instructions.md`.

## Linting and Type Safety

### TypeScript

`.opencode/eslint.config.js` enables:

- `typescript-eslint` recommended rules across all TypeScript.
- `eslint-plugin-unicorn` flat/recommended and `@stylistic` recommended.
- `no-console` at error with `helpers/logger.ts` as the sanctioned logger.
- `unicorn/consistent-boolean-name` with an explicit prefix list and an action-verb exemption pattern.
- Cyclomatic `complexity: ['error', { max: 8 }]` for plugin source, helpers, types, config, and tests.
- `max-lines: 650` for plugin tests.
- A project rule `plugin-export-guard/no-non-plugin-export` that forbids a plugin entry file exporting anything but a `Plugin`-typed value.
- A project rule `ban-disable/no-eslint-disable` that forbids `eslint-disable` comments outright.
- `@typescript-eslint/no-restricted-imports` banning `../*` and `./*` in plugin test files.

`tsc --noEmit` runs with `strict: true`, `target: ES2022`, `moduleResolution: bundler`, and path aliases scoped to tests (`.opencode/tsconfig.json`).

### Python

`ruff` with `select = ["E","F","I","UP","B","C901","SIM","S"]`, `line-length = 100`, `target-version = "py313"`, `max-complexity = 10`, and `ignore = ["S603","S607"]`. `mypy strict = true` excludes `tests/`; `stubs/` is on `mypy_path`.

### Policy enforcement

`scripts/verify_thresholds.sh` fails closed on: a lowered Stryker/Vitest/harness threshold, a `try: true` ESLint override, `complexity` or `no-console` downgraded to `off`/`warn`, a `no-explicit-any` count other than the single allowed test-helper `off`, an `eslint-disable` or `@ts-ignore`/`@ts-nocheck`/`@ts-expect-error` in source, a `type: ignore` in `cli|agents|evals|scripts`, a `SKIP_MUTATION=` assignment in any tracked file, a missing `MUTATION_TIMEOUT`, and a `devcontainers/ci@` count other than five.

## CI/CD

- `.github/workflows/ci.yml` runs two jobs: `prebuild-devcontainer` (12 min budget, GHCR push on `push`) and `ci` (30 min budget).
- `ci` restores the Stryker incremental cache with a segmented key, normalises permissions, runs `just ci` inside `devcontainers/ci`, and saves the cache only when a validation step wrote `.stryker-cache-ok`.
- `scripts/ci.sh` runs 13 gates in a fixed order: `verify-thresholds`, `verify-agents`, `format-check`, `lint`, `markdownlint`, `typecheck`, `test`, `workflow-security`, `opencode-deps`, `opencode-test --coverage`, `opencode-lint`, `opencode-typecheck`, `opencode-mutation`.
- Mutation is conditional: `MUTATION=1` opts in, `SKIP_MUTATION=1`/`CI_FAST=1` skips it and records a pass.
- `just ci-fast` is the documented ~20 s path for docs/yml/justfile-only changes.
- Failure output is summarised and escaped into a GitHub `::error` annotation.
- `.github/workflows/experiment.yml` runs the issue-driven experiment loop; `.github/workflows/publish-template.yml` publishes the DevContainer template.

## Documentation Quality

- `README.md` (499 lines) is the operating manual: repository layout, the three-agent workflow, the command map, CLI placement rules, state ownership, DSH parity, autofix, and eval usage.
- Per-directory knowledge bases exist for `agents/`, `cli/`, `evals/`, `.dsh/`, `.opencode/plugins/`, and `.opencode/plugins/tests/`; each states structure, where to look, conventions, and local anti-patterns.
- 23 instruction files under `.opencode/instructions/` act as binding per-file-type rules, and `steering-message.md` defines the message contract.
- Plugin entry points carry multi-paragraph rationale headers that name the v2 migration, the state keys, and the ordering constraints.
- Weak spots: `README.md:16` lists `*.baseline.json` under `evals/` while `README.md:183` and the tree put baselines at the repository root (`auto_research.baseline.json`); `gate-config.ts:10-13` asserts "85/90/72 coverage/mutation thresholds are unchanged", which duplicates a fact owned by three other files.

## Technical Debt Register

| # | Item | Location | Impact | Evidence |
|---|---|---|---|---|
| 1 | Steering delivered as a user prompt instead of a synthetic message | `quality-gate-enforcer.ts:80` | The signal enters the model's turn as if a human spoke; the repo's own steering contract forbids it | `steering-message.md` requires `context.session.synthetic(...)`, "never `session.prompt`" |
| 2 | Duplicated `readFilePath` | `quality-gate-enforcer.ts:20-24`, `instructions-loader.ts:49-53` | Two copies of the same `path`/`filePath` compatibility shim | verbatim duplication |
| 3 | Duplicated `quoteShellArgument` | `gate-runner.ts:25-27` (exported), `tool-limit-reminder.ts:98` (local) | Shell-escaping logic must be fixed twice | identical implementation |
| 4 | Duplicated Bun template-array builder | `gate-runner.ts:90-92`, `tool-limit-reminder.ts:104-105` | Same `Object.assign([command], { raw })` trick in two files | identical implementation |
| 5 | Two glob matchers | `helpers/glob-match.ts:15` (Bun `Glob`), `goal-continuation.ts:65-73` (regex) | Different semantics for the same concept; a fix in one does not reach the other | two implementations |
| 6 | Duplicated idle-event predicate and `PluginEvent` alias | `goal-continuation.ts:52-55`, `tool-limit-reminder.ts:137-145` | `session.idle` vs `session.status` handling drifts | two definitions |
| 7 | Dead production batcher | `gate-runner.ts:177-254` | ~78 lines and a tested contract with no production caller | referenced only from `gate-runner.test.ts` |
| 8 | Dead single-gate formatter | `gate-formatter.ts:24-31` | A second, divergent steering shape that nothing emits | referenced only from `gate-formatter.test.ts` |
| 9 | Loaded but unused `debounceMs` | `gate-config.ts:26`, `harness.config.ts:88`, plugin destructures only `{ gates }` at `quality-gate-enforcer.ts:44` | A config value that looks active but changes nothing | grep: no consumer |
| 10 | Unused status types | `types/quality-gate.ts:5,30` | Types advertise a state model the plugin does not use | `GateKVState`, `GateStateEntry` unused in source |
| 11 | Serial gate execution | `quality-gate-enforcer.ts:71-76` | A file matching three gates waits for all three, each up to 300 s | `for … of matched` with `yield*` |
| 12 | Unconditional status write | `quality-gate-enforcer.ts:78` | Storage write on every event even when no status changed | unconditional `storage.set` |
| 13 | Workspace-path coupling | `harness.config.ts:26,31,36,41,46` | Gate commands hardcode `cd /workspace`, so the plugin only works at that path | five literal prefixes |
| 14 | Undeclared `effect` dependency | `.opencode/package.json:11-15` | Transitive resolution decides the plugin runtime version | grep: no `effect` entry |
| 15 | Cross-generation SDK types | `helpers/logger.ts:6`, `helpers/session-helpers.ts:1` | `@opencode-ai/sdk` 1.x types beside `@opencode/*` 2.0.24 | imports present |
| 16 | No Python coverage floor | `scripts/ci.sh:71`, `pyproject.toml` | Python changes are gated on passing tests only, not on coverage | absence of `--cov` |
| 17 | Deferred config-literal hoist | `harness.config.ts:13` | `TODO: DEFERRED` marker on an ADR-owned follow-up | inline comment |
| 18 | Stale README path | `README.md:16` vs `README.md:183` | Documentation drift about where baselines live | two statements disagree |

## Positives Worth Preserving

- The gate-status diff model is correct: only transitions are reported, so a stable state does not spam the session.
- Timeout handling has two independent layers (coreutils `timeout -k` plus an in-process race), so a gate promise always settles.
- Plugin tests build a real fake `Context` and drive the actual `effect` closure, rather than testing extracted functions in isolation.
- The threshold pin is a single fail-closed script that reads the real config files, so a weakened gate cannot pass review unnoticed.
- Redundant-but-explicit configuration typing (`GateConfig[]`, `ToolLimitConfig`) is documented at the declaration site, which prevents a subtle `as const` widening bug.
