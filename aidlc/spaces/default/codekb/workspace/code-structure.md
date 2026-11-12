# Code Structure

## Repository Layout

```text
/workspace/
├── agents/                 # pydantic-ai edge agent + tracing (System A)
├── cli/                    # Click CLI: main.py → commands/ → services/
├── evals/                  # eval runner, datasets, baselines, eval config
├── tests/                  # Python test suite
├── config.py               # model registry and provider factories
├── pyproject.toml          # hatchling, ruff, mypy, pytest config
├── justfile                # global gates + 7 module imports
├── .opencode/              # OpenCode harness: plugins, instructions, agents, configs
├── .dsh/                   # DeepSeek Harness template (System B)
├── .github/                # CI workflows, Copilot agents, prompts, PR/issue templates
├── .agents/skills/         # skill marketplace (43 skills)
├── .devcontainer/          # Python 3.13 + Node 24 + Bun + Ollama environment
├── mcp/                    # MCP gateway catalog and Docker config
├── workflows/              # Conductor YAML workflows
├── scripts/                # CI, experiment, eval, and maintenance scripts
├── agent_utils/            # notification, session-review, and memory validation scripts
├── aidlc-plugins/          # project-authored AI-DLC plugin (quality gates sensor)
├── automa-workflows/       # exported Automa browser workflows
├── docs/                   # reveal.js site and prose guides
├── templates/              # untrusted-code DevContainer template
├── hooks/local/            # experiment loop hook scripts
├── stubs/zstandard/        # type stubs for a third-party package
└── experiments/            # runtime experiment state (gitignored subsets)
```

## Package and Module Organisation

### Python packages (root-level, no `src/`)

| Package | Entry point | Layering |
|---|---|---|
| `agents` | `agents/edge.py` | runtime agent + `edge_tracing.py`; imports `config` |
| `evals` | `evals/runner.py` | runner → datasets → `agents.edge` → `config` |
| `cli` | `cli/main.py` | routing (`main.py`) → logic (`commands/`) → services (`services/`) |
| `scripts` | individual scripts | shell/Python tasks, not an installed package |
| `tests` | `tests/test_*.py` | mirrors production modules; command tests prefixed `test_cli_` |

Rules visible in the tree:

- Click decorators appear only in `cli/main.py`; `cli/commands/*.py` export `run_*` functions.
- Shared setup lives in `cli/commands/command_context.py`; reusable services in `cli/services/`.
- `config.py` is the single model registry (`MODEL_FACTORIES`, `MODEL_SETTINGS`).

### TypeScript plugin package (`.opencode/`)

| Path | Role | Loaded by runtime |
|---|---|---|
| `plugins/*.ts` | plugin entry points, default-export one `Plugin` | yes |
| `plugins/helpers/*.ts` | shared modules (gate runner, instruction indexer, workday helpers) | no |
| `plugins/types/*.ts` | shared type declarations | no |
| `plugins/config/harness.config.ts` | per-plugin configuration sections | no |
| `plugins/tests/**` | Vitest tests, harnesses, fixtures, mocks | no |

Five entry points: `quality-gate-enforcer.ts`, `instructions-loader.ts`, `goal-continuation.ts`, `tool-limit-reminder.ts`, `workflow.ts`.

### Scoped `justfile` modules

Seven modules are imported by the root: `agent_utils`, `evals`, `scripts`, `docs`, `agents`, `cli`, `opencode` (a symlink to `.opencode/justfile`). Every module sets `working-directory := ".."` and is invoked as `just <module>::<recipe>`. The root holds only global gates plus `mod` lines, and `just verify-agents` enforces that boundary.

## File Classification

| Category | Files |
|---|---|
| Model/Entity | `agents/edge.py` (`AgentOutput`, `ConfidenceEnum`), `config.py` (`ModelConfig`), `plugins/types/*.ts`, `cli/services/project_config.py` (`ProjectConfig`, `TaskPromptConfig`) |
| Controller/Handler | `cli/main.py`, `plugins/*.ts` (hook registration), `workflows/*.yaml` |
| Service/UseCase | `cli/commands/*.py`, `evals/runner.py`, `scripts/experiment.py`, `plugins/helpers/gate-runner.ts`, `plugins/helpers/instruction-indexer.ts` |
| Repository/DAO | `cli/services/experiment_storage.py`, `plugins/helpers/kv-store.ts`, `plugins/helpers/instruction-entry-client.ts` |
| Utility/Helper | `plugins/helpers/{glob-match,gate-formatter,logger,review,tool-limit,session-helpers}.ts`, `agent_utils/scripts/*.py` |
| Configuration | `pyproject.toml`, `justfile` (+7 modules), `.opencode/{package.json,tsconfig.json,vitest.config.ts,eslint.config.js,stryker.config.mjs}`, `.devcontainer/*`, `.dsh/*`, `mcp/catalog.yaml`, `opencode.jsonc`, `autofix.toml`, `evals/config.toml` |
| Middleware | `scripts/ci.sh` (gate sequencer), `scripts/verify_thresholds.sh` (policy gate) |
| Test | `tests/*.py`, `.opencode/plugins/tests/**`, `.agents/skills/*/tests/**` |
| Migration | none |
| Static/Asset | `docs/*.html`, `docs/theme/`, `evals/assets/`, `.agents/skills/**/*.md` |

## Code Patterns

- **Factory-per-alias model registry.** `config.py` maps an alias to a zero-argument factory so client construction happens at resolution time, not import time.
- **Scoped Effect composition.** Each plugin body is one `Effect.gen` closure; registrations are scoped, so unloading releases them.
- **Write-through caches beside durable storage.** `goal-continuation.ts` keeps a `Map` as the in-process authority and `context.storage` as the durable copy, hydrating on load to survive hot reload.
- **Storage key namespacing.** Keys are `<prefix>/<sessionID>` (`gates/`, `goal/`, `goal-gate/`, `review/`, `idempotency/`, `native-seed/`).
- **Status-diff reporting.** A gate reports only on a transition, so a stable pass or stable fail produces no message.
- **Typed literal guards against `as const` widening.** `harness.config.ts` declares `qualityGates: GateConfig[]` and `toolLimit: ToolLimitConfig` explicitly so the `as const` on the parent object does not produce readonly types the interfaces reject.
- **Test harness factory per plugin.** Each plugin test builds a fake `Context` with storage, prompts/synthetics, and captured hooks, then drives it with `Effect.runPromise(Effect.scoped(plugin.effect(ctx)))`.
- **Path aliases only in tests.** `@plugins/*` and `@tests/*` resolve from `tsconfig.json` and `vitest.config.ts`; plugin source uses relative imports because the runtime does not resolve aliases.

## Dependency Direction Rules

- `agents` → `config`; `evals` → `agents`, `config`; `cli` → `cli.services`, `cli.commands`; `tests` → production packages.
- `plugins/*.ts` → `./helpers/*`, `./types/*`, `./config/harness.config`; helpers never import an entry point.
- `.opencode/plugins/**` never imports Python; Python never imports TypeScript.
- `.opencode/plugins/tests/**` must not use relative imports for production modules (lint-enforced); it must import `REPO_ROOT` from `tests/helpers/repo-root` rather than deriving the checkout root.
