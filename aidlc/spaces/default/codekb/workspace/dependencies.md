# Dependencies

## Internal Dependency Graph

### Python

```text
config.py                        -> httpx, openai, pydantic_ai        (verified: config.py:6-13)
agents/edge.py                   -> config, agents.edge_tracing, pydantic, pydantic_ai
                                    (verified: agents/edge.py:32-37)
evals/runner.py                  -> agents.edge, config, evals.smoke, pydantic_evals.reporting
                                    (verified: evals/runner.py:31-35)
evals/smoke.py, extended.py,
  long_inputs.py                 -> the edge agent and a pydantic_evals dataset
                                    (inferred from README.md:14-16 and evals/AGENTS.md)
cli/main.py                      -> cli.commands.* (design, discover, experiment, fix, init,
                                    memory_viz, validate)  (verified: cli/main.py:5-17)
cli/commands/*                   -> cli.services.* per the cli/AGENTS.md placement rules
cli/commands/task_runner.py      -> cli.services.copilot_session, cli.services.project_config
                                    (verified: task_runner.py:10-11)
scripts/experiment.py            -> evals runner, experiments/ state
scripts/run_skill_evals.py       -> opencode CLI, .agents/skills (verified: run_skill_evals.py:1-17)
agent_utils/scripts/*.py         -> .serena/memories, .agents/skills (validation only)
```

No circular import was found in the modules that were read; the unread modules are listed above with the basis for their edges.

### TypeScript

```text
plugins/quality-gate-enforcer.ts -> helpers/gate-config, helpers/gate-runner, helpers/glob-match,
                                    helpers/gate-formatter, types/quality-gate, bun ($), effect
plugins/instructions-loader.ts   -> helpers/{instruction-indexer,instruction-context-helper,
                                    instruction-payload,instruction-entry-client,instruction-carrier,
                                    service-client}, types/instructions, effect
plugins/goal-continuation.ts     -> config/harness.config, helpers/goal-nudges, types/goal-enforcement,
                                    @opencode/schema/{agent,session,tool}, effect
plugins/tool-limit-reminder.ts   -> config/harness.config, helpers/tool-limit, types/tool-limit,
                                    @opencode/schema/{agent,session,tool}, bun ($), node:fs/promises, effect
plugins/workflow.ts              -> config/harness.config, helpers/{subtask-ls,workflow-subtask,
                                    workflow-types,subtask-tail,workflow-client-adapter,
                                    instruction-entry-client}, effect
helpers/gate-config.ts           -> config/harness.config, types/quality-gate
helpers/gate-runner.ts           -> types/quality-gate
helpers/gate-formatter.ts        -> helpers/gate-runner, types/quality-gate
helpers/glob-match.ts            -> bun (Glob)
helpers/instruction-indexer.ts   -> helpers/glob-match, js-yaml
helpers/instruction-carrier.ts   -> helpers/{instruction-entry-client,service-client}
helpers/logger.ts                -> @opencode-ai/sdk (OpencodeClient)
helpers/session-helpers.ts       -> @opencode-ai/sdk (OpencodeClient)
```

Helpers never import an entry point; the graph is acyclic. Plugin entry points are the only files the loader evaluates.

### Cross-language boundary

None. Python never imports TypeScript and TypeScript never imports Python. The only shared artefacts are files (instruction Markdown, `.opencode/plugins/config/harness.config.ts`, gate command strings) and processes (`just` recipes that both sides invoke).

## External Dependencies

### Python (declared)

| Package | Constraint | Declared in | Notes |
|---|---|---|---|
| `pydantic` | `>=2,<3` | `pyproject.toml:14` | Upper bound pins v2 semantics |
| `pydantic-ai[evals]` | `>=0.0.14` | `pyproject.toml:15` | Lower bound only; no upper bound, so a minor bump can change agent APIs |
| `httpx` | `>=0.27` | `pyproject.toml:16` | `_CopilotTransport` subclasses `httpx.AsyncHTTPTransport` |
| `click` | `>=8.1,<10` | `pyproject.toml:17` | Upper bound excludes a hypothetical Click 10 |

### Python (undeclared but imported)

| Package | Imported at | Risk |
|---|---|---|
| `openai` | `config.py:7` (`AsyncOpenAI`) | Arrives transitively through `pydantic-ai`; a transitive change can break `config.py` at import |
| `opentelemetry` / `logfire` | `agents/edge_tracing.py` per `agents/AGENTS.md` and `README.md:420` | Tracing bootstrap; not declared in `pyproject.toml` |
| `zstandard` | session tailing via `stubs/zstandard/` | A stub directory exists for typing, not a declared runtime dependency |

### Python (development)

| Package | Constraint | Purpose |
|---|---|---|
| `pytest` | `>=8.2` | Test runner, `testpaths = ["tests"]` |
| `pytest-asyncio` | `>=0.23` | `asyncio_mode = "auto"` |
| `anyio` | `>=4.4` | Async backend used by `pytest-asyncio` |
| `ruff` | `>=0.4` | Lint and format |
| `mypy` | `>=1.10` | `strict = true`, `exclude = ["tests/"]` |

### TypeScript (declared)

| Package | Constraint | Installed | Risk |
|---|---|---|---|
| `@opencode/plugin` | `^2.0.24` | 2.0.24 | The API surface plugins compile against |
| `@opencode-ai/sdk` | `^1.18.34` | 1.x | Its types are mixed with `@opencode/*` 2.0.24 types in `helpers/logger.ts` and `helpers/session-helpers.ts`; the plugin-interface guidance calls those generations non-interchangeable |
| `js-yaml` | `5.4.2` (pinned) | 5.4.2 | Exact pin, read-only use |

### TypeScript (undeclared but imported)

| Package | Imported at | Risk |
|---|---|---|
| `effect` | every plugin and helper that uses `Effect`, `Stream`, `Schema` | Not listed in `package.json`; resolved transitively at `4.0.0-rc.112`. A single installed copy is required (`Effect.isEffect` and schema brand checks fail across copies) |
| `@opencode/client` | type-only via `@opencode/plugin` re-exports (`SessionSyntheticInput`) | Installed at 2.0.24 alongside the plugin package |
| `@opencode/schema` | `goal-continuation.ts`, `tool-limit-reminder.ts`, `workflow.ts` | Installed transitively |
| `bun` | `quality-gate-enforcer.ts`, `tool-limit-reminder.ts`, `helpers/glob-match.ts` | Runtime-provided; mapped to a shim under Vitest and Stryker |

### TypeScript (development)

`typescript` ~6.0.3, `typescript-eslint` ^8.70.0, `@typescript-eslint/{eslint-plugin,parser}` 8.70.0, `eslint` 10.11.0, `eslint-plugin-unicorn` ^75.0.0, `@stylistic/eslint-plugin` ^5.10.0, `@vitest/eslint-plugin` 1.6.27, `vitest` 4.1.11, `@vitest/coverage-istanbul` ^4.1.11, `@stryker-mutator/core` ^9.6.1, `@stryker-mutator/vitest-runner` ^9.6.1, `tsup` ^8.5.1, `@types/node` ^26.1.0, `@types/js-yaml` 4.0.9.

### External services

| Service | Required for | Absent behaviour |
|---|---|---|
| Ollama | default eval provider | Falls back only if `GITHUB_COPILOT_API_TOKEN` is set |
| GitHub Copilot API | Copilot provider and `llm_judge_default` | `_llm_judge_factory` raises `ValueError` rather than falling back to Ollama |
| GitHub Models inference API | `build_github_model` | Returns `None` and the judge factory tries Copilot next |
| OpenRouter | `edge_agent_local_openrouter` | Model construction succeeds; calls fail without `OPENROUTER_API_KEY` |
| MCP gateway | nine MCP servers | Tools unavailable; no plugin depends on them |
| Docker / DevContainer CLI | every test, lint, and CI run | The documented fallback is `devcontainer exec -- just <recipe>` |
| `dsh` CLI | DeepSeek Harness runs | Harness plane unavailable; System A unaffected |

## Dependency Health

- **Lockfiles present**: `uv.lock` (Python), `.opencode/bun.lock` (TypeScript), `docs/bun.lock`, `.dsh/child-runtime/pnpm-lock.yaml`. CI installs with `bun install --frozen-lockfile` (`.opencode/justfile:8-9`).
- **Pinned exact versions**: `js-yaml` 5.4.2, `@typescript-eslint/*` 8.70.0, `@types/js-yaml` 4.0.9, `eslint` 10.11.0, `vitest` 4.1.11, `@vitest/eslint-plugin` 1.6.27, plus every GitHub Action (`checkout@v6`, `cache/restore@v6`, `docker/login-action@v4`, `devcontainers/ci@v0.3.1900000450`).
- **Floating ranges that matter**: `pydantic-ai[evals]>=0.0.14` and `effect` (undeclared) are the two places a routine install could change behaviour without a repository change; the plugin guidance already requires a single `effect` copy.
- **Cross-generation type mixing**: `@opencode-ai/sdk` 1.x types sit beside `@opencode/*` 2.0.24 in `helpers/logger.ts` and `helpers/session-helpers.ts`. It typechecks today, but the documented rule is that the generations are not interchangeable.
- **Update automation**: `.github/dependabot.yml` exists; its ecosystems were not read.
