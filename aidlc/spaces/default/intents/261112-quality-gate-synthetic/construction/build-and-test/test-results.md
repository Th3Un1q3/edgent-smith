# Test Results

## Build

| Command | Exit | Output |
|---|---|---|
| `just .opencode/typecheck` | 0 | `$ tsc --noEmit` (no diagnostics) |
| `just .opencode/lint` | 0 | 0 errors, 1 pre-existing warning (`tests/helpers/instruction-indexer.test.ts:33`, `@typescript-eslint/no-non-null-assertion`) |

## Unit tests (scoped)

Command:

```bash
just .opencode/test -- plugins/tests/quality-gate-enforcer.test.ts plugins/tests/helpers/tool-input.test.ts plugins/tests/helpers/steering-message.test.ts plugins/tests/helpers/gate-formatter.test.ts plugins/tests/helpers/gate-runner.test.ts plugins/tests/helpers/gate-config.test.ts plugins/tests/helpers/instruction-payload.test.ts plugins/tests/instructions-loader.test.ts plugins/tests/types/quality-gate.test.ts
```

| Metric | Value |
|---|---|
| Test files | 9 passed (9) |
| Tests | 110 passed (110) |
| Failed | 0 |
| Skipped | 0 |
| Duration | 453 ms |

## Full suite with coverage

Command: `just .opencode/test --coverage` (Vitest + Istanbul through Bun).

| Metric | Value |
|---|---|
| Test files | 40 passed (40) |
| Tests | 922 passed (922) |
| Failed | 0 |
| Statements | 97.69% (2285/2339) |
| Branches | 93.26% (1136/1218) |
| Functions | 97.33% (547/562) |
| Lines | 98.33% (2012/2046) |
| Floor | 90% — met on every metric |

Changed-file coverage: `quality-gate-enforcer.ts` 91.93% statements / 83.33% branches (project floor is measured on the full suite, as the Testing Contract states).

## Mutation

Command: `just .opencode/mutation --mutate plugins/quality-gate-enforcer.ts` (Stryker ran the package suite).

| Metric | Value |
|---|---|
| Mutation score (all files) | 79.54% |
| Covered-code score | 81.29% |
| Killed | 2947 |
| Survived | 695 |
| No coverage | 82 |
| Break threshold | 72 — met |
| `quality-gate-enforcer.ts` score | 86.08% (68 killed, 11 survived) |

## Target verification

| Target | Verdict | Evidence |
|---|---|---|
| T1 Typecheck | Met | Exit 0 |
| T2 Scoped suite | Met | 110/110 passed |
| T3 Coverage floor | Met | 97.69 / 93.26 / 97.33 / 98.33 |
| T4 Mutation break threshold | Met | 79.54 overall, 86.08 for the changed plugin |
| T5 Lint baseline | Met | 0 errors, 1 pre-existing warning |
| T6 CI execution before merge | N/A | The plan runs no CI Pipeline (`ci-pipeline` skipped in the refactor scope) |

## Failures

None. No loop-back was required, so there is no `## Loop-Back Log`.

## Notes on test scope

- No browser or end-to-end check applies: the change is a plugin signal path with no UI.
- The pre-change skip branch is implemented and covered by the mutation run at the statement level, but no case drives the pre-change hook twice; recorded as a known gap at the gate.
