# Build Instructions

## Prerequisites

- Bun and Node per `.tool-versions`; the plugin package's dependencies are committed in `.opencode/bun.lock`.
- Commands run from the repository root. The `just` module recipes set the working directory to `.opencode`.

## Dependency installation

```bash
just .opencode/deps        # bun install --frozen-lockfile
```

Dependencies are already installed in this environment; the command is the reproducible path for a fresh checkout.

## Build (compile check)

```bash
just .opencode/typecheck   # tsc --noEmit
```

The plugin package has no bundling step: the runtime loads `.ts` directly, so a clean `tsc --noEmit` is the build.

## Lint

```bash
just .opencode/lint        # eslint plugins --fix --cache
```

## Test

```bash
# Scoped to the suites this change touches
just .opencode/test -- plugins/tests/quality-gate-enforcer.test.ts plugins/tests/helpers/tool-input.test.ts plugins/tests/helpers/steering-message.test.ts plugins/tests/helpers/gate-formatter.test.ts plugins/tests/helpers/gate-runner.test.ts plugins/tests/helpers/gate-config.test.ts plugins/tests/helpers/instruction-payload.test.ts plugins/tests/instructions-loader.test.ts plugins/tests/types/quality-gate.test.ts

# Full suite with the project-wide coverage floor
just .opencode/test --coverage
```

## Verification steps

1. Typecheck exits 0.
2. Scoped suite reports all tests passed.
3. Full suite with coverage exits 0 and every metric is at or above 90%.
4. Lint exits 0 with no new warnings.

## Troubleshooting

- **`TS2339` on a removed type or setting**: a test or config still references the removed surface; delete the reference rather than restoring the symbol.
- **Coverage below 90%**: add cases for the uncovered branch; never lower the threshold.
- **`bun` not found**: the DevContainer supplies it; do not install it by hand.
- **Mutation gate**: `just .opencode/mutation` runs Stryker; the break threshold is 72.
