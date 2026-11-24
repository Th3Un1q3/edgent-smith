## Plugin Directory & Export Requirements

### Directory Structure

| Path | Purpose | Naming Convention |
|------|---------|-------------------|
| `*.ts` (root) | Plugin entry points only | PascalCase or kebab-case plugins (`quality-gate-enforcer.ts`, `state-machine.ts`) |
| `config/` | Plugin configuration imported by the entry points: `harness.ts` exports `harnessConfig`, one named section per plugin id under `plugins`, and sits in a subdirectory so it is not auto-loaded as a plugin | Single `harness.ts` — path pinned by `scripts/verify_thresholds.sh`, which checks its coverage thresholds; a rename must update that script in the same change |
| `instructions/` | Instruction loading, carrier, indexing, seeding and diagnostics modules | `carrier-<topic>.ts` with `carrier.ts` as the entry, `native-<topic>.ts`, and role names (`context-helper.ts`, `diagnostics.ts`, `identity.ts`, `indexer.ts`, `seeding.ts`), no barrel |
| `workflow/` | Workflow and subtask modules: tracking, classification, results, adapters | `subtask-<topic>.ts` with `subtask.ts` as the entry, plus `client-adapter.ts` and `contracts.ts`, no barrel |
| `gates/` | Quality gate configuration, formatting and runner modules | Role names (`loader.ts`, `run.ts`, `format.ts`), no barrel |
| `helpers/runtime/` | Shared runtime services reached by two or more scopes: glob matching, service client, tool input | camelCase filenames representing their domain (`glob-match.ts`), no barrel |
| `helpers/session/` | Shared session utilities reached by two or more scopes: steering messages | camelCase filename (`steering-message.ts`), no barrel |
| `AGENTS.md` | Discoverable instruction file matched by the `**/AGENTS.md` glob | Must be capitalized — lowercase `agents.md` is not discovered |
| `helpers/` | Shared helper domains reached by two or more scopes: `instructions/`, `runtime/`, `session/` | One directory per domain, no `index.ts` barrel — a barrel must itself be imported by two scopes; no loose files. `helpers/instructions/` holds `entry-client.ts` and `payload.ts`: the `instructions` scope imports the payload directly from `instructions-loader.ts`, and the `workflow` scope reaches it through the entry client |
| `types/` | TypeScript type definitions shared across modules | Descriptive singular or plural names (`instructions.ts`) |
| `sessions/` | Files written by a retired session storage adapter; nothing on the current path writes or reads them | Named by session id (`ses_<id>.json`) — no code creates new files |
| `tests/` | Unit and integration tests for the plugin | Structure and file names mirror the source, scope directory included: `gates/run.ts` -> `tests/gates/run.test.ts`; `.test.ts` suffix |

### Placement rule

A module has two homes. A module that serves one plugin lives in that plugin's scope directory (`gates/`, `instructions/`, `state-machine/`, `tool-limit-reminder/`, `workflow/`), with the entry point at `plugins/<name>.ts`. A module that two or more scopes reach, directly or through a barrel, lives in `plugins/helpers/`. A new file starts in the scope directory that imports it and moves to `helpers/<domain>/` when a second scope reaches it; `config/` and `types/` hold what the entry points and several scopes read. Reach is transitive and follows re-export barrels: a module a barrel re-exports is reached by every scope that imports the barrel, so a utility reached by two scopes only through a domain barrel stays in `helpers/`. When no scope imports a barrel, the barrel is dead and is removed with its re-exports; the modules it re-exported are judged on their own importers.

### Verifying a move

Three checks decide whether a move or a restructure landed. Run them before the gates; each catches a failure the gates do not name.

- **Every `helpers/` module has two scopes.** For each `helpers/<domain>/<file>.ts`, list the files importing it outside `helpers/` and `tests/`: `grep -rl "helpers/<domain>/<file>" .opencode/plugins --include=*.ts | grep -v "/helpers/" | grep -v "/tests/"`. Fewer than two distinct scope directories means the module belongs in the one scope that imports it. Filter file paths, never the matching lines: every import line names `helpers/`, so a line filter reports zero reach for every module. The direct count is a lower bound: a module one scope imports and a `helpers/` module re-exports is reached by every scope importing that re-exporter, so follow the re-export chain before moving it — `helpers/session/steering-message.ts` has one direct importer and two scopes, the second through `helpers/instructions/payload.ts`.
- **Every barrel has an importer.** For each `index.ts`, list the modules that import it. No importer means the barrel is dead: delete it, then judge each module it re-exported on its own importers. Never describe a barrel in this file before that check passes.
- **No path names the old location.** `grep -rn "<old path>" .opencode/plugins/tests tests scripts docs AGENTS.md .opencode/instructions` returns no hit before the gates run. Tests and `scripts/verify_thresholds.sh` pin source paths, so a rename must update every pin in the same change.

### Quality Gates

All these quality gates need to pass to conclude that the plugin is valid and ready for use.

Tests: `just opencode::test` (from repo root)
Linter: `just opencode::lint`
Typecheck: `just opencode::typecheck`

All commands support additional parameters eg. to run a single test file: `just opencode::test -- tests/instructions/indexer.test.ts`

### Test text conventions

Tests never pin template or fixture prose. Derive expectations from the same renderer or file production uses — the shared helper `tests/helpers/state-machine/template-text.ts` — and assert behaviour: emitted once, only after the triggering event, right template identity. A wording edit must not break the suite.

### Technical Stack

Plugins ecosystem uses:
- TypeScript - language
- Vitest - test runner
- Bun - runtime
- eslint - linter
- tsc - typescript compiler

**Import style:** Plugin source files use relative imports (`./gates/run`, `./helpers/runtime/glob-match`).
The `@plugins/*` and `@tests/*` aliases from `.opencode/tsconfig.json` are for test files only.
See `.opencode/instructions/opencode-plugin-interfaces.instructions.md` for details.

### State machine plugin conventions

The session loop is a machine directory, `state-machine/machines/session/`, holding `machine.json`, `signals.manifest.json`, `context.ts`, the `templates/*.md` wording, and the definition modules that sit beside it. Each definition module owns one kind of body: `action-builders.ts` every action body (`createActions`), `guard-builders.ts` every guard body (`createGuards`), `prompt-templates.ts` prompt rendering and `promptDescription`, `record-actions.ts` the record callbacks that turn an event into context updates, `payload-readers.ts` the reads of host payload shape (`session.inbox.enqueued` fields, callback payloads), `signal-specs.ts` the signal schemas, registry and `updateSignalsPolicySpecs`, `definition-contract.ts` the action, guard, prompt and record parameter types plus `ACTION_TYPES` and `GUARD_TYPES`, and `template-files.ts` the loading and rendering of `templates/*.md`. A reader looks for an action in `action-builders.ts`, a guard in `guard-builders.ts`, a prompt's wording in `templates/` with its rendering in `prompt-templates.ts`, and a signal schema in `signals.manifest.json` beside `signal-specs.ts`. `context.ts` carries the context shape, its defaults, the snapshot field allowlist and its limits. `state-machine/machines/index.ts` is the registry, where each entry carries `{ id, definition, manifest, transientStates, definitions, contexts }`, and the module also exports the default snapshot codec, the default state ids and the callback names. `state-machine/core/` holds the assembler (`core/machine.ts`) and the generic signal engine (`core/signals.ts`), plus generic infrastructure shared across machines, and defines no session field, state, signal, template, callback or machine id. A new machine is one directory under `state-machine/machines/` with `machine.json`, `signals.manifest.json`, `definitions.ts` and `context.ts`, plus one registry entry wiring all four — `core/` is not edited. These invariants came from live sessions and a unit-test suite that stayed green while the host did nothing; keep them when editing it. Edit rules for states, guards, actions, signals and snapshots: `.opencode/instructions/state-machine.instructions.md`.

- **The loop never speaks first.** A fresh session's entry emits are held on the machine and handed over by `wake()` on the first real user message; a state change before that drops them. Do not deliver `define_goal`'s prompt at `session.created` — the agent invents a goal from an empty chat.
- **Only waiting states reset.** `parked` and `panic` return to `define_goal` on a real user item. The active work state does not: the message that started the turn arrives after `SET_GOAL` and would wipe the goal mid-work. A new reset arm needs a reason the goal cannot be lost.
- **Idle is one arm on `towards_goal`.** `system_idle` sits on the compound `towards_goal` state, where the `counter_below` guard on `nudges` (limit 3) increments the counter and prompts `idle_nudge`, and the fourth idle records `idle budget exhausted` and moves to `panic`. `parked` and `panic` declare empty `system_idle` arms, so an idle there changes nothing.
- **A user item opens the session first.** The message can be the first access after a hot reload; the loop reaches the machine through `access`, the attach-or-fail accessor in `state-machine/core/machine-service.ts`, which restores it from its snapshot rather than answering with an empty result. `state-machine.ts` opens the session before it wakes or delivers the item.
- **One shape per host payload.** `session.inbox.enqueued` carries `data.item.type` and `data.item.payload.text`; read them through `core/inbox.ts` rather than a hand-rolled assumption, and mirror the same shape in the test harness.
- **Snapshots store keys, not prose.** `skill:<name>:complete` and `mem:<path>:complete|ref` are the memory markers; command results stay complete for workflows. Only goal text is capped.
- **The gate is `rug`-only and one message.** A block names the tool and the transition that leaves the state; a state with no rule allows. A block is `Tool.Error` with `metadata = { code: 'tool_blocked', tool, state, allowed_tools }`.
- **Signals are declared once and enabled by one slot.** `signals.manifest.json` holds each `describe` and schema; an entry action names its own `set_enabled_signals`, and `core/signals.ts` refuses a name the registry does not declare. Do not derive the list from state arms or a `stateId`.
- **Advertising is an action.** `update_signals_policy` emits `emit.signals` when it notifies the agent; the plugin sends a separate synthetic. Do not append availability to a prompt template.
- **A prompt names itself.** `prompt` carries a `description` declared with the action; the plugin sends it beside the synthetic. `promptDescription` falls back to `Sent synthetic message: <opening words>...` when an emit supplies none. Do not reintroduce a state-keyed description map.
- **Refusals are errors, acceptance is neutral.** `unknown_signal`, `unavailable_signal` and `invalid_payload` are `Tool.Error` with structured `metadata`; `Signal accepted.` is the only successful result text.
- **Prove a hook change with a live `rug` run.** See the plugin-hook section of `.opencode/instructions/live-verification.instructions.md`; unit fakes are not evidence about the host.
