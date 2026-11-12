# API Documentation

The repository exposes no HTTP or gRPC server. Its interfaces are a Click CLI, a set of `just` recipes, Conductor workflow inputs, OpenCode plugin hook/tool contracts, and the MCP catalog. Those are documented here.

## Click CLI

Entry point: `uv run python -m cli` (`cli/__main__.py` → `cli/main.py:273-274`).

| Group | Command | Arguments and options | Behaviour |
|---|---|---|---|
| — | `hello` | `--name` (default `world`) | Prints a greeting |
| — | `memory-viz` | `--memories-dir`, `--output` (default `memory-graph.html`), `--open` | Renders the Serena memory store as a standalone HTML graph |
| `autoresearch` | `init` | `--name` (required), `--baseline-id`, `--eval-model` (default `edge_agent_default`) | Verifies the Copilot CLI and writes `<name>.config.toml` |
| `autoresearch` | `validate` | `--config` | Validates the environment and session persistence; auto-discovers `*.config.toml` |
| `autoresearch` | `design` | `BRIEF?`, `--config`, `--transcript-file` | Generates or refines an experiment design spec |
| `autoresearch` | `discover` | `--config`, `--transcript-file` | Refreshes `docs/ideas.md` from recent papers |
| `autoresearch` | `fix` | `--config`, `--autofix-config` (default `autofix.toml`), `--continue`, `--parallel` | Runs the staged autofix workflow |
| `autoresearch experiment` | `create` | `--title` (required), `--description` (required) | Creates a pending experiment record |
| `autoresearch experiment` | `start` | `EXPERIMENT_ID`, `--baseline-id`, `--before-score`, `--rerun-of` | Starts a run |
| `autoresearch experiment` | `finish` | `EXPERIMENT_ID`, `--status completed\|failed\|cancelled`, `--after-score` | Closes the current run |
| `autoresearch experiment` | `list` | `--status`, `--baseline-id`, `--outcome`, `--limit`, `--sort asc\|desc`, `--sort-by created_at\|updated_at` | Lists registry entries |
| `autoresearch experiment` | `show` | `EXPERIMENT_ID` | Prints one experiment in full |

The `experiment` group manages registry CRUD only; execution stays with `scripts/experiment.py`.

## Evaluation Runner CLI

`evals/runner.py` is invoked as `python evals/runner.py` through the `just evals::*` recipes.

| Flag | Meaning |
|---|---|
| `--baseline-id <id>` | Baseline file `<id>.baseline.json` to compare against and the candidate lane to write |
| `--set <spec>` | Dataset spec: `smoke` (default), `module:attr`, `dotted.path.obj`, or a bare name resolved as `evals.<name>` |
| `--model <alias>` | Model alias resolved by `config.resolve_model_config` |

Provider selection is environmental, not a flag: `GITHUB_COPILOT_API_TOKEN` selects Copilot, otherwise Ollama (`evals/runner.py:1-6`).

Skill-eval CLI: `scripts/run_skill_evals.py` takes `--config`, `--model`, `--agent`, and resolves per-skill `evals/config.toml` from four discovery locations (`evals/config.toml:1-11`).

## Conductor Workflows

| Workflow | Inputs | Purpose |
|---|---|---|
| `workflows/skill_eval_workflow.yaml` | `skill`, `cases` (default `1-7`), `max_turns` (default `4`), `timeout` (default `600`) | Runs a skill's eval cases through `rug-swe` and grades transcripts |
| `workflows/test_script_workflow.yaml` | script-step inputs | Exercises Conductor script steps |

Invoked as `just skill-eval <skill> [cases] [max_turns] [timeout]` (`justfile:69-71`).

## OpenCode Plugin Contracts

### Plugin module contract

```ts
interface Plugin {
  readonly id: string
  readonly effect: (context: Context) => Effect.Effect<void, never, Scope.Scope>
}
export default plugin
```

Every entry point default-exports one object. The loader scans root `plugins/*.ts` only.

### Tool hooks consumed

| Hook | Payload used | Registered by |
|---|---|---|
| `tool.hook('execute.before')` | `{ tool, sessionID, agent, input }` | Quality Gate Enforcer, Instructions Loader, Goal Continuation, Tool Limit Reminder |
| `tool.hook('execute.after')` | `{ tool, sessionID, agent, input, status }` | Quality Gate Enforcer, Tool Limit Reminder |
| `session.hook('prompt')` | `{ sessionID, prompt: { text } }` | Tool Limit Reminder (prepends `<task-budget … />`), Goal Continuation (re-arms the gate) |
| `context.event.subscribe()` | `session.idle`, `session.status`, `session.agent.selected`, `session.created` | Goal Continuation, Tool Limit Reminder, Workflow Subtask Plugin |
| `tool.transform(editor)` | `editor.add({ name, description, input, options, execute })` | Goal Continuation, Workflow Subtask Plugin |

Path extraction accepts either `input.path` or `input.filePath` because v2 tool inputs use `path` while older payloads carried `filePath` (`quality-gate-enforcer.ts:19-24`).

### Tools registered

| Tool | Input schema | Output |
|---|---|---|
| `goal` | `{ action: 'set' \| 'clear', text?: string }`, required `action` | `{ content: 'ok' }` or a `Tool.Error` |
| `subtask_ls` | Subtask listing parameters; implemented in `helpers/subtask-ls.ts` | Existing subtasks read from session storage |
| `subtask_run` | Subtask parameters, with `DEFAULT_MAX_SUBTASKS` and `DEFAULT_SUBTASK_AGENT` defaults from `helpers/workflow-types.ts` | Child subtask session handle and initial output |
| `subtask_tail` | Subtask identifier; implemented in `helpers/subtask-tail.ts` | Recorded tail output |

### Session delivery contract

`context.session.prompt` and `context.session.synthetic` are different carriers.

```ts
type SessionSyntheticInput = {
  sessionID: Session.ID
  id?: SessionMessage.ID        // must start with "msg_" when supplied
  text: string
  description?: string
  metadata?: Record<string, unknown>
  delivery?: SessionInbox.Delivery
  resume?: boolean
}
```

- `prompt` starts a model turn; `synthetic` appends a message without treating it as a human utterance.
- `steering-message.md` makes `synthetic` the only sanctioned delivery path for `<steering>` content and forbids `session.prompt` for it.
- A correlation key belongs in `metadata`; `id` is validated as a branded `SessionMessage.ID` that must open with `msg_`.

### Steering message format

```xml
<steering priority="info|warning|high" reason="..." type="instructions|quality-gate|todo" result="pass|fail" gate-id="...">
  body
</steering>
```

Current producer: `formatGateBatchResults` emits `priority`, `reason`, `type="quality-gate"`, `result`, and a body of one line per outcome: the check mark, the gate name, the previous and new status, the command, and the exit code (`helpers/gate-formatter.ts:33-47`). `formatGateFailure` emits a single-gate variant with `gate-id` but is unused in production (`helpers/gate-formatter.ts:24-31`).

### Configuration contract

`plugins/config/harness.config.ts` exports one `as const` object whose `plugins` keys are plugin ids.

| Section | Shape |
|---|---|
| `quality-gate-enforcer` | `{ gates: GateConfig[], debounceMs?: number }`; `GateConfig = { name, patterns: string[], commands: string[], timeoutMs?: number }` |
| `tool-limit-reminder` | `{ factor, padding, limits, ignoreTools, review }` |
| `goal-continuation` | `{ enforceAll, agents, optOut, readOnlyAllowlist, maxSteeringRepeats }` |
| `workflow` | `{ instructions: string, agents: string[] }` |

`loadQualityGates()` rejects a config with fewer than five gate entries (`helpers/gate-config.ts:18-22`).

## `just` Recipe Surface

Root recipes (global gates only): `test`, `lint`, `typecheck`, `ci`, `ci-fast`, `format`, `format-check`, `clean`, `verify-agents`, `oc`, `oc-log`, `skill-eval`.

Notable scoped recipes:

| Recipe | Effect |
|---|---|
| `just evals::eval [baseline] *ARGS` | Runs the eval runner |
| `just evals::local` | Smoke dataset on the OpenRouter alias |
| `just evals::ci` | All datasets against `auto_research` |
| `just .opencode::test *ARGS` | Vitest with the Istanbul provider |
| `just .opencode::lint`, `typecheck`, `mutation` | ESLint, `tsc --noEmit`, Stryker |
| `just scripts::run-experiment`, `run-experiment-loop` | Script-backed experiment execution |
| `just agents::edge-agent <prompt>` | Runs the edge agent with OTLP tracing |
| `just docs::lint`, `fix`, `serve` | Markdownlint and the reveal.js site |

## MCP Catalog

`mcp/catalog.yaml` declares nine servers behind a gateway at `http://mcp_gateway:8080/mcp` (`opencode.jsonc:108-113`).

| Server | Type | Transport |
|---|---|---|
| `tavily` | remote | HTTP with bearer token |
| `deepwiki` | remote | HTTP |
| `serena` | remote | HTTP to `http://serena:9121/mcp` |
| `devtools` | remote | HTTP to a host-side Chrome DevTools proxy |
| `context7` | remote | HTTP with bearer token |
| `github` | remote | HTTP, read-only |
| `fetch` | server | container image |
| `youtube-transcript` | server | container image |
| `filesystem` | server | digest-pinned image, write-enabled on a fixed directory allowlist |

## Environment Contracts

| Variable | Consumer | Effect |
|---|---|---|
| `GITHUB_COPILOT_API_TOKEN` | `evals/runner.py`, `config.build_copilot_model` | Selects the Copilot provider |
| `GITHUB_MODEL_API_TOKEN` | `config.build_github_model` | Enables the GitHub inference judge model |
| `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL` | `config.build_openrouter_model` | OpenRouter alias |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL_NAME` | `config.build_ollama_model` | Ollama alias |
| `EDGENT_MODEL_ALIAS`, `EDGENT_PRESET`, `EDGENT_OVERRIDES`, `HARD_MAX_OUTPUT_TOKENS` | `agents/edge.py` | Runtime model selection and parameter caps |
| `MUTATION`, `MUTATION_TIMEOUT`, `SKIP_MUTATION`, `CI_FAST` | `scripts/ci.sh` | Mutation-gate participation and timeout |
| `INSTRUCTION_INJECTION` | `instructions-loader` carrier resolver | Carrier selection; an unknown value warns and falls back to `synthetic` |
| `AFK_FLAG_FILE` | `just agent_utils::afk` | Path of the AFK flag file |
