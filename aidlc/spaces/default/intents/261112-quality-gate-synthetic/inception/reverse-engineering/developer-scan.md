## Developer Code Scan Results

### Scan Coverage

- **Analyzed deeply**:
  - `.opencode/plugins/quality-gate-enforcer.ts`, `.opencode/plugins/helpers/gate-config.ts`, `gate-runner.ts`, `gate-formatter.ts`, `glob-match.ts`, `.opencode/plugins/types/quality-gate.ts`, `.opencode/plugins/config/harness.config.ts`
  - `.opencode/plugins/instructions-loader.ts`, `.opencode/plugins/goal-continuation.ts`, `.opencode/plugins/tool-limit-reminder.ts`, `.opencode/plugins/workflow.ts`
  - `.opencode/plugins/tests/quality-gate-enforcer.test.ts`, `tests/helpers/gate-runner.test.ts` (first 60 lines), `tests/helpers/repo-root.ts`, `tests/__utils__/factories/client-factory.ts`, `tests/AGENTS.md`, `plugins/AGENTS.md`
  - `.opencode/package.json`, `.opencode/tsconfig.json`, `.opencode/vitest.config.ts`, `.opencode/eslint.config.js`, `.opencode/stryker.config.mjs`, `.opencode/justfile`
  - `.opencode/instructions/` (directory listing; `steering-message.md`, `opencode-plugin-interfaces.instructions.md`, `comments.instructions.md`, `writing-style.instructions.md`, `justfiles.instructions.md`, `threshold-policy.instructions.md`, `no-permission-workarounds.instructions.md`, `live-verification.instructions.md`, `tdd-enforcement.instructions.md`, `plugin-tests-imports.instructions.md` via steering delivery)
  - `.opencode/node_modules/@opencode/plugin/dist/effect/session.d.ts`, `@opencode/client/dist/effect/api/api.d.ts` (installed type surface only)
  - Root: `pyproject.toml`, `justfile`, `README.md`, `AGENTS.md`, `config.py`, `opencode.jsonc`, `autofix.toml`, `limited_context.config.toml`
  - `cli/main.py`; `agents/edge.py` (module header + `AgentOutput`); `evals/runner.py` (module header); `evals/config.toml`
  - `scripts/ci.sh`, `scripts/verify_thresholds.sh`; `evals/justfile`, `scripts/justfile`, `cli/justfile`, `agents/justfile`, `agent_utils/justfile`, `docs/justfile`
  - `.devcontainer/devcontainer.json`, `.github/workflows/ci.yml`, `mcp/catalog.yaml` (server names), `aidlc-plugins/quality-gates/.opencode-plugin/plugin.json`
  - Directory inventories for `agents/`, `cli/commands/`, `cli/services/`, `evals/`, `tests/`, `scripts/`, `scripts/conductor/`, `agent_utils/scripts/`, `workflows/`, `hooks/local/`, `templates/untrusted-code-sandbox/`, `automa-workflows/`, `.agents/skills/`, `.github/agents/`, `.github/workflows/`, `.github/instructions/`, `.devcontainer/`, `.dsh/`, `docs/`, `stubs/`

- **Skimmed only**:
  - `agents/edge_tracing.py`, `cli/commands/*` beyond `main.py`, `cli/services/*`
  - `evals/smoke.py`, `evals/extended.py`, `evals/long_inputs.py`, `evals/cases/`, `evals/claims/`, `evals/entities/`, `evals/assets/`
  - `scripts/experiment.py`, `scripts/*.sh`, `scripts/run_skill_evals.py`, `scripts/validate_workflow_security.py`
  - `tests/` (names only), `agent_utils/scripts/*.py`
  - `.agents/skills/` (43 skill directories, names only), `docs/` (file names only), `.dsh/` (AGENTS.md + directory names; `cordis.patch.yml` and `settings.yaml` unread), `.github/prompts/`, `.github/copilot/`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE/`
  - `aidlc-plugins/quality-gates/` (plugin manifest + directory names), `automa-workflows/*.automa.json`, `templates/untrusted-code-sandbox/`, `stubs/zstandard/`

- **Left out**:
  - `.venv/`, `.opencode/node_modules/`, `docs/node_modules/`, `.dsh/child-runtime/node_modules/`, `.pnpm-store/`, `.dsh/.pnpm-store/`
  - `__pycache__/`, `.opencode/coverage/`, `.opencode/reports/`, `aidlc-plugins/quality-gates/dist/`, `.mypy_cache/`, `.ruff_cache/`, `.pytest_cache/`, `.cache/`
  - `.git/`, `.codegraph/`, `.copilot/`, `.logs/`, `.tmp/`, `secrets/`, `.serena/`
  - AI-DLC's own install and generated projection: `.aidlc/`, `aidlc/`, `.opencode/agents/aidlc-*.md`, `.opencode/command/aidlc.md`, `.opencode/plugin/aidlc-opencode-adapter.ts`, and the AI-DLC-marked sections of `AGENTS.md` and `.gitignore`

### Packages Found

- `edgent-smith` — Python application package — Python — hatchling project root; wheels from `agents`, `evals`, `cli` (`pyproject.toml:1-3,29-30`)
- `opencode-plugins` (`@opencode` plugin workspace, unnamed in `package.json`) — TypeScript plugin suite — TypeScript (Bun runtime) — OpenCode v2 harness plugins (`.opencode/package.json:1-33`)
- `aidlc-quality-gates` — AI-DLC plugin — TypeScript + Markdown — project-authored AIDLC sensor/plugin (`aidlc-plugins/quality-gates/.opencode-plugin/plugin.json:1-8`)
- Skill marketplace — 43 skill directories — Markdown + Python/TypeScript scripts — `.agents/skills/`
- Agent card / prompt assets — Markdown — `.github/agents/*.agent.md`, `.github/prompts/`, `.opencode/agents/*.md`

### Build System

- **Type**:
  - Python: `uv` + hatchling; tests via pytest; lint/format via ruff; types via mypy
  - TypeScript: Bun + `bun.lock`; `tsc` typecheck; `tsup` build script defined but unused by CI; Vitest tests; Stryker mutation
  - Task orchestration: `just`, with the root importing seven modules
- **Config Files**: `pyproject.toml`, `uv.lock`, `.opencode/package.json`, `.opencode/bun.lock`, `.opencode/tsconfig.json`, `.opencode/vitest.config.ts`, `.opencode/eslint.config.js`, `.opencode/stryker.config.mjs`, `justfile` + 7 scoped `justfile`s
- **Build Dependencies**:
  - `cli` → `cli.services`, `cli.commands`
  - `evals` → `agents.edge`, `config`, `evals.smoke`
  - `agents` → `config`, `agents.edge_tracing`
  - `.opencode/plugins/*` (entry points) → `./helpers/*`, `./types/*`, `./config/harness.config`
  - `tests/**` → `@plugins/*`, `@tests/*` path aliases (test-only)

### APIs Discovered

- Click CLI — `cli/main.py` — root group plus `autoresearch` and `experiment` subgroups; 12 leaf commands: `hello`, `memory-viz`, `autoresearch {init,validate,design,discover,fix}`, `autoresearch experiment {create,start,finish,list,show}`
- OpenCode plugin hooks — `.opencode/plugins/*.ts` — `tool.hook('execute.before')` in 4 plugins and `execute.after` in 2; `session.hook('prompt')` in 2; `context.event.subscribe()` streams in 3; `tool.transform` in 2
- OpenCode plugin tools — `goal` (`goal-continuation.ts:274-300`), `subtask_ls`/`subtask_run`/`subtask_tail` (`workflow.ts:34-36`)
- Conductor workflows — `workflows/` — 2 workflows (`skill_eval_workflow.yaml`, `test_script_workflow.yaml`); `workflows/skill_eval_workflow.yaml` takes `skill`, `cases`, `max_turns`, `timeout`
- Eval runner CLI — `evals/runner.py` — `--baseline-id`, `--set`, `--model`, plus dataset spec resolution (`module:attr`, dotted path)
- Skill-eval CLI — `scripts/run_skill_evals.py` — per-skill config discovery, `--config`, `--model`, `--agent`
- MCP servers — `mcp/catalog.yaml` — 9 entries: 6 `remote` (`tavily`, `deepwiki`, `serena`, `devtools`, `context7`, `github`) and 3 `server` (`fetch`, `youtube-transcript`, `filesystem`); gateway at `http://mcp_gateway:8080/mcp` (`opencode.jsonc:108-113`)
- No HTTP server is defined by this repo; `just scripts::serve-web` starts the OpenCode web UI, not project code.

### Frameworks & Libraries

- `pydantic-ai[evals]` — `>=0.0.14` (`pyproject.toml:15`) — agent runtime and eval orchestration
- `pydantic` — `>=2,<3` — structured output models
- `httpx` — `>=0.27` — Copilot transport patching
- `click` — `>=8.1,<10` — CLI
- `openai` (transitive via pydantic-ai) — async client used directly in `config.py:7`
- `effect` — `4.0.0-rc.112` — plugin Effect runtime
- `@opencode/plugin` — `2.0.24` — OpenCode v2 plugin API
- `@opencode/client` — `2.0.24` — typed client surface (`SessionSyntheticInput`)
- `vitest` — `4.1.11` — plugin tests
- `eslint` — `10.11.0` with `typescript-eslint` 8.70.0, `eslint-plugin-unicorn` ^75, `@stylistic/eslint-plugin` ^5.10, `@vitest/eslint-plugin` 1.6.27
- `@stryker-mutator/core` / `vitest-runner` — `^9.6.1` — mutation gate
- `typescript` — `~6.0.3` — typecheck
- `js-yaml` — `5.4.2` — YAML parsing (workflow plugin)
- `ruff` — `>=0.4`, `mypy` — `>=1.10`, `pytest` — `>=8.2`, `pytest-asyncio` — `>=0.23`, `anyio` — `>=4.4`

### Test Coverage

- **Test Directories**: `.opencode/plugins/tests/` (13 test files + `helpers/`, `__mocks__/`, `fixtures/`, `types/`, one setup file), `tests/` (27 Python test files + `test_session_audit/`), `.agents/skills/*/tests/` (skill-local)
- **Test Frameworks**: Vitest 4.1.11 (TypeScript), pytest 8.2+ with `pytest-asyncio` `asyncio_mode = "auto"` (Python)
- **Coverage Config**: present for TypeScript — `.opencode/vitest.config.ts:46-51` sets 90% branches/functions/lines/statements; the harness gate command restates 85% (`.opencode/plugins/config/harness.config.ts:26`). Absent for Python: no `--cov` and no `fail_under` in `pyproject.toml`.

### Code Quality Indicators

- **Linting**:
  - Python: ruff at `pyproject.toml:32-45` (`line-length = 100`, `target-version = "py313"`, select `E,F,I,UP,B,C901,SIM,S`, `max-complexity = 10`)
  - TypeScript: `.opencode/eslint.config.js` — unicorn + stylistic + typescript-eslint, `complexity max 8`, `max-lines 650` for plugin tests, custom `plugin-export-guard` and `ban-disable` rules; `eslint-disable` comments are forbidden outright
  - Both pinned fail-closed by `scripts/verify_thresholds.sh` (gate 0)
- **CI/CD**: `.github/workflows/ci.yml` (prebuild + `just ci` inside the DevContainer), `.github/workflows/experiment.yml`, `.github/workflows/publish-template.yml`; local gate order in `scripts/ci.sh:65-94` (13 gates, mutation conditional)
- **Documentation**: `README.md` (499 lines, current except for stale claims noted below) plus per-directory `AGENTS.md` knowledge bases (`agents/`, `cli/`, `evals/`, `.dsh/`, `.opencode/plugins/`, `.opencode/plugins/tests/`); module docstrings are dense and rationale-bearing in TypeScript plugins, thinner in Python service modules

### Technical Debt Signals

- **Steering delivered through a user prompt**: `quality-gate-enforcer.ts:80` uses `context.session.prompt({ resume: false })`, while `.opencode/instructions/steering-message.md` mandates `context.session.synthetic(...)` and says "never `session.prompt`". Every sibling plugin complies (`instructions-loader.ts:531`, `goal-continuation.ts:240,337`, `tool-limit-reminder.ts:325,335`).
- **Duplicated helper logic**:
  - `readFilePath` — verbatim copy in `quality-gate-enforcer.ts:20-24` and `instructions-loader.ts:49-53`
  - `quoteShellArgument` — exported at `gate-runner.ts:25-27`, re-implemented locally at `tool-limit-reminder.ts:98`
  - Bun template-array builder — `makeTemplateArray` at `gate-runner.ts:90-92` and `asTemplate` at `tool-limit-reminder.ts:104-105`
  - Glob matching — `helpers/glob-match.ts:15` (Bun `Glob`) and a second regex implementation at `goal-continuation.ts:65-73`
  - `PluginEvent` type alias and idle predicate — duplicated in `goal-continuation.ts:52-55` and `tool-limit-reminder.ts:137-145`
- **Dead or test-only production code**: `createDirtyGateBatcher` (`gate-runner.ts:177-254`) and `formatGateFailure` (`gate-formatter.ts:24-31`) are referenced only from tests; `debounceMs` is loaded and validated by `gate-config.ts:26` and set to 1500 in `harness.config.ts:88` but never read by the plugin (`quality-gate-enforcer.ts:44` destructures only `{ gates }`); `GateKVState` and `GateStateEntry` (`types/quality-gate.ts:5,30`) are unused in source.
- **Per-gate serial execution**: `quality-gate-enforcer.ts:71-76` awaits each matched gate in a `for` loop, so a file touched by several gates pays the sum of gate runtimes, each up to 300 s.
- **Write amplification**: `runMatched` persists the whole status map on every event (`quality-gate-enforcer.ts:78`) even when no outcome was produced.
- **Stale/threshold-adjacent config comments**: `gate-config.ts:10-13` explains a `>=5` gate-shape floor and asserts "85/90/72 coverage/mutation thresholds are unchanged"; `harness.config.ts:26` hardcodes `cd /workspace/...` in every gate command, so the plugin only works when the workspace path is exactly `/workspace`.
- **Python coverage gap**: no line-coverage floor and no coverage collection for Python (`scripts/ci.sh:71` runs `just test` without coverage), while TypeScript is gated at 90% (85% in the harness gate command).
- **Suppressed/disabled checks**: none found in scanned source (`# noqa`/`@ts-ignore`/`eslint-disable` are banned and absent); `pyproject.toml:39` ignores `S603`/`S607` for subprocess use.
- **TODO markers**: `harness.config.ts:13` carries a `TODO: DEFERRED` on hoisting config literals.
- **Unused/uncommitted working-tree state**: `git status` shows modified skill and `.devcontainer` files plus untracked AI-DLC projection; the scan read the on-disk state.

## Handoff Summary

- **Intent-relevant finding**: `quality-gate-enforcer.ts` is the only signal-emitting plugin in `.opencode/plugins/` that reports through `context.session.prompt({ resume: false })` (`quality-gate-enforcer.ts:80`) instead of `context.session.synthetic(...)`, which the repo's own `.opencode/instructions/steering-message.md` names as the sole sanctioned delivery path and explicitly says never to use `session.prompt` for. The message bodies in `helpers/gate-formatter.ts:24-47` are already `<steering …>` XML, so the payload shape is compatible with the synthetic carrier; `SessionSyntheticInput` additionally accepts `description`, `metadata`, `delivery`, and `resume` (`@opencode/client/dist/effect/api/api.d.ts:344-354`), which the current call path cannot carry. The consolidation surface is concrete: five duplicated helpers, one test-only batcher, one unused formatter, one loaded-but-unused `debounceMs`, and two unused status types (see **Technical Debt Signals**).
- **Risks / follow-up**:
  - `context.session.prompt` and `context.session.synthetic` differ in turn semantics: `prompt` starts a model turn, `synthetic` appends a message. The intent must decide whether `resume: false` behaviour is preserved by `synthetic`'s `resume` field or whether gating behaviour changes (only `goal-continuation.ts:340` currently sets `delivery: 'steer'`).
  - Any consolidation into shared helpers must keep `.opencode/eslint.config.js` green: `plugin-export-guard` forbids non-`Plugin` exports from plugin root files, `complexity max 8` applies to helpers, and `@typescript-eslint/no-restricted-imports` bans relative imports from plugin test files.
  - The gate tests assert `h.prompts` on a fake `context.session.prompt` (`tests/quality-gate-enforcer.test.ts:44-46,90-93`); moving to `synthetic` changes the fake and every assertion in that file.
  - The gate command strings hardcode `/workspace` (`harness.config.ts:26`); consolidation must not silently drop that assumption without a decision.
  - Coverage thresholds are pinned by `scripts/verify_thresholds.sh:58-80` (vitest 90, harness 85, stryker 72/80/60); they may not be lowered to accommodate refactoring.
  - The scan read an unclean tree: `git status` reports modified `.agents/skills/*` and `.devcontainer/*` files at head `f50f410532776a9c10dd7d9b5c3133a06ba80b3e`.
