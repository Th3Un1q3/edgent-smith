# Technology Stack

## Languages

| Language | Version | Where | Evidence |
|---|---|---|---|
| Python | `>=3.13` (devcontainer 3.13) | `agents/`, `evals/`, `cli/`, `scripts/`, `tests/`, `agent_utils/scripts/` | `pyproject.toml:10`, `.devcontainer/devcontainer.json:12-13` |
| TypeScript | `~6.0.3` | `.opencode/plugins/**`, `aidlc-plugins/quality-gates/tools/` | `.opencode/package.json:29` |
| Bash | system | `scripts/*.sh`, `justfile` recipes, `.devcontainer/setup-dev.sh` | files |
| Markdown | — | instructions, skills, docs, agent definitions | files |
| YAML | — | workflows, DSH config, MCP catalog, Conductor workflows | files |

## Runtimes and Build Tools

| Tool | Version | Purpose | Evidence |
|---|---|---|---|
| `uv` | feature-installed | Python dependency and command runner | `.devcontainer/devcontainer.json:15` |
| hatchling | build backend | Python build | `pyproject.toml:1-3` |
| Bun | `1.4.2` | TypeScript runtime and package manager for `.opencode`; the `$` shell used by plugins | `.devcontainer/devcontainer.json:17-19`, `.opencode/justfile:7-15` |
| Node.js | `24` | Runs Stryker, `markdownlint-cli2`, `npm exec` | `.devcontainer/devcontainer.json:9-11`, `docs/justfile:9-15` |
| `just` | feature-installed | Task runner; root plus seven modules | `justfile:10-16` |
| `tsc` | via TypeScript 6 | Typecheck (`bun run --bun typecheck`) | `.opencode/justfile:26-27` |
| `tsup` | `^8.5.1` | Declared build script, not invoked by CI | `.opencode/package.json:6,28` |
| `eslint` | `10.11.0` | TypeScript lint | `.opencode/package.json:26` |
| `vitest` | `4.1.11` | TypeScript tests with Istanbul coverage | `.opencode/package.json:31`, `.opencode/vitest.config.ts:39-51` |
| `pytest` | `>=8.2` | Python tests, `asyncio_mode = "auto"` | `pyproject.toml:22,54-60` |
| `ruff` | `>=0.4` | Python lint and format | `pyproject.toml:25,32-45` |
| `mypy` | `>=1.10` | Python typecheck, `strict = true` | `pyproject.toml:26,47-52` |
| Stryker (`@stryker-mutator/core`) | `^9.6.1` | Mutation gate | `.opencode/package.json:17-18`, `.opencode/stryker.config.mjs` |
| `markdownlint-cli2` | `0.23.2` (pinned in recipe) | Markdown lint | `docs/justfile:10-15` |
| `conductor` | CLI on PATH | Runs YAML workflows | `justfile:69-71` |
| `dsh` | `0.1.1-rc.2` | DeepSeek Harness | `README.md:286`, `.dsh/cordis.patch.yml` |
| `opencode` | 1.18.29+ / OpenCode 2 | Harness and plugin host | `.aidlc/onboarding.md` prerequisites |

## Application Dependencies

### Python runtime

| Package | Constraint | Role |
|---|---|---|
| `pydantic` | `>=2,<3` | Structured output models |
| `pydantic-ai[evals]` | `>=0.0.14` | Agent runtime, model providers, `pydantic_evals` |
| `httpx` | `>=0.27` | Transport patch for the Copilot API |
| `click` | `>=8.1,<10` | CLI framework |

`config.py:7` also imports `openai.AsyncOpenAI` directly. `openai` is not declared in `pyproject.toml`; it arrives transitively through `pydantic-ai`.

### TypeScript runtime and development

| Package | Constraint | Role |
|---|---|---|
| `@opencode/plugin` | `^2.0.24` (installed 2.0.24) | Plugin API, Effect and promise variants |
| `@opencode/client` | installed 2.0.24 | Typed client surface (`SessionSyntheticInput`) |
| `@opencode-ai/sdk` | `^1.18.34` | `OpencodeClient` type used by `helpers/logger.ts` and `helpers/session-helpers.ts` |
| `effect` | installed `4.0.0-rc.112` | Effect runtime; not declared in `package.json` |
| `js-yaml` | `5.4.2` | YAML frontmatter parsing in `helpers/instruction-indexer.ts` |
| `typescript` | `~6.0.3` | Compiler |
| `typescript-eslint` | `^8.70.0` | Lint rules |
| `@typescript-eslint/{eslint-plugin,parser}` | `8.70.0` | Pinned lint internals |
| `eslint-plugin-unicorn` | `^75.0.0` | Lint rules |
| `@stylistic/eslint-plugin` | `^5.10.0` | Formatting rules |
| `@vitest/eslint-plugin` | `1.6.27` | Vitest lint rules |
| `@vitest/coverage-istanbul` | `^4.1.11` | Coverage provider (v8 is unusable on Bun) |
| `@types/node` | `^26.1.0` | Node types |
| `@types/js-yaml` | `4.0.9` | YAML types |

## Data and Persistence

| Store | Format | Location |
|---|---|---|
| Experiment registry | JSON + Markdown | `experiments/index.json`, `experiments/experiments/<id>/{spec.md,status.json,meta.json}` |
| Script-runner state | JSON | `experiments/<issue>.state.json`, `experiments/manual.state.json` |
| Baselines | JSON | `auto_research.baseline.json`, `<id>.baseline-candidate.json`, per-baseline-id `<id>.baseline.json` files |
| Plugin durable state | `context.storage` (JSON values) | keyed `<prefix>/<sessionID>` |
| Settings | TOML | `evals/config.toml`, `limited_context.config.toml`, `autofix.toml` |
| Harness config | TypeScript literal | `.opencode/plugins/config/harness.config.ts` |
| Infrastructure config | JSON/JSONC/YAML | `opencode.jsonc`, `.devcontainer/*`, `.dsh/*`, `mcp/catalog.yaml` |

No relational database, cache server, or object store is used.

## Infrastructure and Platform

| Service | Role | Evidence |
|---|---|---|
| DevContainer (Docker Compose) | The only development and CI runtime | `.devcontainer/docker-compose.yml` |
| Ollama | Local model provider on port 11434 | `.devcontainer/devcontainer.json:59-60` |
| Jaeger | OTLP trace viewer on 16686 / 4318 | `.devcontainer/devcontainer.json:62-67` |
| GitHub Actions | CI and the experiment workflow, both inside `devcontainers/ci@v0.3.1900000450` | `.github/workflows/ci.yml:45,100` |
| GHCR | Prebuilt devcontainer image `ghcr.io/th3un1q3/edgent-smith` | `.github/workflows/ci.yml:47-49` |
| MCP gateway | Single remote endpoint for nine MCP servers | `opencode.jsonc:108-113` |
| Serena | Code intelligence MCP and memory namespace | `mcp/catalog.yaml:28-34` |
| OpenCode web UI | Served on `127.0.0.1:49374` for the tunnel sidecar | `scripts/justfile:68-91` |

## Language and Tooling Conventions

- Python: `from __future__ import annotations`, `StrEnum` where enumerated strings are needed, dataclasses for config records, `snake_case` naming, line length 100.
- TypeScript: no semicolons in plugin source, single quotes, `import type` for type-only imports, relative imports in source and `@plugins/*`/`@tests/*` aliases in tests only, cyclomatic complexity cap 8.
- Effect: one `Effect.gen` closure per plugin, scoped registrations, `Effect.orDie` / `Effect.ignore` at hook boundaries to keep the caller's tool working.
- Shell: `set -euo pipefail`; `just` recipes use `bash -euo pipefail -c` and `working-directory` instead of `cd &&`.
