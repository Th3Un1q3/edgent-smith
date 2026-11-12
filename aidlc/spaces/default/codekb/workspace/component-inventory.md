# Component Inventory

Twenty-seven components. **Responsibility** states what the component exists to do; **Depends on** lists what it reads or calls at runtime.

## Execution Plane

### Edge Agent Runtime

- **Responsibility**: Build one pydantic-ai `Agent` with three inline tools (calculator, current datetime, web-search stub), define the structured `AgentOutput`, and expose `build_edge_agent` / `run_edge_agent` with tracing, timeout fallback, and tool-usage reporting.
- **Key files**: `agents/edge.py`
- **Depends on**: `config.py`, `agents/edge_tracing.py`, `pydantic`, `pydantic_ai`

### Model Configuration Registry

- **Responsibility**: Map a model alias to a factory and settings, keeping provider construction out of import time. Aliases: `edge_agent_default`, `edge_agent_fast`, `edge_agent_local_openrouter`, `llm_judge_default`.
- **Key files**: `config.py`
- **Depends on**: `httpx`, `openai`, `pydantic_ai` providers (Ollama, OpenAI, Copilot transport patch)

## Evaluation Plane

### Evaluation Runner

- **Responsibility**: Select a provider, resolve a dataset spec, run the edge agent over it, aggregate case scores, and compare against a baseline file.
- **Key files**: `evals/runner.py`, `evals/smoke.py`, `evals/extended.py`, `evals/long_inputs.py`, `evals/config.toml`
- **Depends on**: `agents.edge`, `config`, `pydantic_evals.reporting`

## Workflow Plane

### CLI Service Agents

- **Responsibility**: Provide the Click command surface and its command/service split — routing in `main.py`, logic in `commands/`, stateless services in `services/`.
- **Key files**: `cli/main.py`, `cli/__main__.py`, `cli/commands/{design,discover,experiment,fix,init,memory_viz,task_runner,validate,command_context}.py`, `cli/services/{copilot_session,experiment_storage,hf_papers,project_config}.py`
- **Depends on**: `click`, the autofix hook config, the Copilot CLI

### Experiment Runner Scripts

- **Responsibility**: Run the issue-backed and local experiment loops: bootstrap a baseline, hand the hypothesis to a Copilot session, score the candidate, and record per-issue state.
- **Key files**: `scripts/experiment.py`, `scripts/promote_baseline.sh`, `scripts/baseline_status.sh`, `scripts/terminalize_experiment.py`, `scripts/parse_draft.py`, `scripts/format_experiment_output.py`
- **Depends on**: the eval runner, `experiments/` state, git

### Conductor Workflows

- **Responsibility**: Orchestrate multi-step agent runs from YAML — skill evaluation cases and script-step tests — with human-in-the-loop steps where configured.
- **Key files**: `workflows/skill_eval_workflow.yaml`, `workflows/test_script_workflow.yaml`, `workflows/step1.sh`, `workflows/step2.sh`
- **Depends on**: the `conductor` CLI, `scripts/run_skill_evals.py`, the skill marketplace

### CI Gate Runner

- **Responsibility**: Run the ordered quality gates and aggregate failures into workflow annotations; pin thresholds fail-closed before anything else runs.
- **Key files**: `scripts/ci.sh`, `scripts/verify_thresholds.sh`, `scripts/ci_ensure_env.sh`, `scripts/validate_workflow_security.py`
- **Depends on**: every `just` gate recipe, `.github/workflows/ci.yml`

### Task Runner Recipes

- **Responsibility**: Own the command surface for the project — twelve global gates in the root and seven scoped modules — with a CI-enforced boundary between them.
- **Key files**: `justfile`, `evals/justfile`, `scripts/justfile`, `docs/justfile`, `agents/justfile`, `cli/justfile`, `agent_utils/justfile`, `.opencode/justfile` (reached through the `opencode/` symlink)
- **Depends on**: `uv`, `bun`, `opencode`, `conductor`, `markdownlint-cli2`

### Agent Utils Scripts

- **Responsibility**: Provide notification, session export/review, AFK toggling, and memory/skill validation recipes plus their Python validators.
- **Key files**: `agent_utils/justfile`, `agent_utils/scripts/{audit_fences,validate_md_links,validate_memory_frontmatter}.py`
- **Depends on**: `opencode` CLI, `.serena/memories` (through the gateway, never the filesystem), the skill marketplace

## Harness Plane

### OpenCode Plugin Host

- **Responsibility**: Load root `plugins/*.ts` modules, run each default export's `effect(context)` in a scope, and release every registration on unload.
- **Key files**: `.opencode/package.json`, `.opencode/tsconfig.json`, `.opencode/vitest.config.ts`, `.opencode/eslint.config.js`, `.opencode/stryker.config.mjs`, `opencode.jsonc`
- **Depends on**: `@opencode/plugin` 2.0.24, `effect` 4.0.0-rc.112, `@opencode/client` 2.0.24

### Quality Gate Enforcer

- **Responsibility**: On `edit`/`write` of a file matching a configured gate, run that gate's commands before and after the change and deliver a `<steering>` status-transition message.
- **Key files**: `.opencode/plugins/quality-gate-enforcer.ts`, `.opencode/plugins/helpers/gate-config.ts`, `gate-runner.ts`, `gate-formatter.ts`, `glob-match.ts`, `.opencode/plugins/types/quality-gate.ts`, `.opencode/plugins/tests/quality-gate-enforcer.test.ts`
- **Depends on**: Harness Configuration, Bun `$`, `ctx.storage`, `ctx.session.prompt` (current carrier)

### Instructions Loader

- **Responsibility**: Match instruction files to the touched path and agent, publish them to native session storage when available, and fall back to one synthetic append per path per session.
- **Key files**: `.opencode/plugins/instructions-loader.ts`, `.opencode/plugins/helpers/{instruction-indexer,instruction-payload,instruction-entry-client,instruction-carrier,instruction-context-helper}.ts`, `.opencode/plugins/types/instructions.ts`
- **Depends on**: Project Instruction Set, Skill Marketplace, Harness Configuration, `ctx.storage`, `ctx.session.synthetic`

### Goal Continuation

- **Responsibility**: Own the `goal` tool, the goal-first enforcement gate on `execute.before`, and the idle nudge loop, with gate state persisted so a hot reload does not re-arm a session.
- **Key files**: `.opencode/plugins/goal-continuation.ts`, `.opencode/plugins/helpers/goal-nudges.ts`, `.opencode/plugins/types/goal-enforcement.ts`
- **Depends on**: Harness Configuration, `ctx.agent.list`, `ctx.storage`, `ctx.session.synthetic`, `ctx.event.subscribe`

### Tool Limit Reminder

- **Responsibility**: Count tool calls per session, enforce a three-tier budget (advertise `<task-budget>`, warn at the limit, block past limit + padding), and export the session for review on idle.
- **Key files**: `.opencode/plugins/tool-limit-reminder.ts`, `.opencode/plugins/helpers/{tool-limit,review}.ts`, `.opencode/plugins/types/tool-limit.ts`
- **Depends on**: Harness Configuration, `ctx.agent.get`, `ctx.session.update`, `ctx.session.synthetic`, Bun `$`, `ctx.event.subscribe`

### Workflow Subtask Plugin

- **Responsibility**: Register `subtask_ls`, `subtask_run`, and `subtask_tail`; inject a `<workflow_instructions>` block for allowlisted agents; strip a prior block before injecting a new one.
- **Key files**: `.opencode/plugins/workflow.ts`, `.opencode/plugins/helpers/{workflow-subtask,workflow-client-adapter,workflow-types,subtask-ls,subtask-tail}.ts`
- **Depends on**: Harness Configuration, `ctx.tool.transform`, `ctx.session`, the session storage entry client

### Harness Configuration

- **Responsibility**: Hold every plugin's configuration in one `as const` object keyed by plugin id, in a subdirectory so the loader does not treat it as a plugin.
- **Key files**: `.opencode/plugins/config/harness.config.ts`
- **Depends on**: `.opencode/plugins/types/*`

### Project Instruction Set

- **Responsibility**: Define binding rules for file types and behaviours — comments, markdown voice, justfiles, tests, plugin interfaces, steering messages, permissions, storage, skills.
- **Key files**: `.opencode/instructions/*.instructions.md` (23 files), `.opencode/instructions/steering-message.md`
- **Depends on**: the skill marketplace for procedure it delegates (e.g. `unslop`, `refactoring-patterns`)

### OpenCode Harness Agents

- **Responsibility**: Define the OpenCode subagents and their routing — the RUG orchestrator, the RUG SWE worker, the team coach, and the evaluation grader.
- **Key files**: `.opencode/agents/{rug,rug-swe,rug-team-coach,evaluation-grader}.md`
- **Depends on**: Project Instruction Set, Skill Marketplace

### Copilot Custom Agents

- **Responsibility**: Define the GitHub Copilot agents and prompt templates that design experiments, implement them, and brainstorm.
- **Key files**: `.github/agents/{brainstorm,edge-architect,implement}.agent.md`, `.github/prompts/`, `.github/copilot-instructions.md`, `.github/instructions/{gh-actions,writing-style}.instructions.md`
- **Depends on**: `.github/workflows/experiment.yml`

### AI-DLC Quality Gate Plugin

- **Responsibility**: Contribute the project's own linters, tests, and gates to the AI-DLC workflow as an advisory `build-and-test` sensor, so the workflow enforces existing gates instead of inventing new ones.
- **Key files**: `aidlc-plugins/quality-gates/.opencode-plugin/plugin.json`, `aidlc-plugins/quality-gates/sensors/aidlc-harness-gates.md`, `aidlc-plugins/quality-gates/tools/aidlc-sensor-harness-gates.ts`, `aidlc-plugins/quality-gates/contributions/construction/`
- **Depends on**: Task Runner Recipes, the AI-DLC engine

## Supporting Components

### Skill Marketplace

- **Responsibility**: Hold 43 reusable capability packages, each a `SKILL.md` router plus workflow and reference files, loaded on demand.
- **Key files**: `.agents/skills/*/SKILL.md`, `.agents/skills/*/references/`, `.agents/skills/*/workflows/`, `.agents/skills/*/evals/`
- **Depends on**: nothing at runtime; consumed by every harness

### Docs Site

- **Responsibility**: Publish the reveal.js deck and the prose guides (harness engineering, migration notes, model matrix, system overview).
- **Key files**: `docs/index.html`, `docs/new-deck.html`, `docs/theme/`, `docs/package.json`, `docs/justfile`, `docs/*.md`
- **Depends on**: `bun`, `markdownlint-cli2`

### Automa Workflows

- **Responsibility**: Hold exported Automa browser-automation workflows for job-board scraping.
- **Key files**: `automa-workflows/Manual Indeed Jobs.automa.json`, `automa-workflows/Manual LI Jobs.automa.json`, `automa-workflows/Manual Xing Jobs.automa.json`
- **Depends on**: the Automa browser extension

### Untrusted-Code Sandbox Template

- **Responsibility**: Provide a DevContainer template for running untrusted code with a restricted environment.
- **Key files**: `templates/untrusted-code-sandbox/devcontainer-template.json`, `templates/untrusted-code-sandbox/.devcontainer/`, `templates/untrusted-code-sandbox/NOTES.md`
- **Depends on**: the DevContainer CLI

## Infrastructure Components

### DevContainer Environment

- **Responsibility**: Provide the single development and CI runtime — Python 3.13, Node 24, Bun 1.4.2, `uv`, `just`, Ollama, Jaeger, the OpenCode web UI port, and the DSH web port.
- **Key files**: `.devcontainer/devcontainer.json`, `.devcontainer/docker-compose.yml`, `.devcontainer/setup-dev.sh`, `.devcontainer/init.sh`, `.devcontainer/.env.example`
- **Depends on**: GitHub Container Registry, Docker

### DSH Harness Configuration

- **Responsibility**: Template the DeepSeek Harness home — provider and model pins, sandbox policy, subagent plugin patch, child runtime composition, and agent presets.
- **Key files**: `.dsh/settings.yaml`, `.dsh/cordis.patch.yml`, `.dsh/child-runtime/cordis.yml`, `.dsh/.agent-presets/{orchestrator,worker,orch-worker}/agent.cordis.yml`, `.dsh/README.md`, `.dsh/AGENTS.md`
- **Depends on**: `dsh` 0.1.1-rc.2, pnpm

### MCP Gateway Catalog

- **Responsibility**: Declare the nine MCP servers the gateway exposes and the secret each remote server needs.
- **Key files**: `mcp/catalog.yaml`, `mcp/docker-config.json`
- **Depends on**: the MCP gateway service, Docker, the secret environment variables
