## Plugin Directory & Export Requirements

### Directory Structure

| Path | Purpose | Naming Convention |
|------|---------|-------------------|
| `*.ts` (root) | Plugin entry points only | PascalCase or kebab-case plugins (`harness-plugin.ts`, `state-machine.ts`) |
| `helpers/*.ts` | Shared utility modules, helpers, and discovery logic | camelCase filenames representing their domain (`kv-store.ts`, `logger.ts`, `file-discovery.ts`) |
| `AGENTS.md` | Discoverable instruction file matched by the `**/AGENTS.md` glob | Must be capitalized — lowercase `agents.md` is not discovered |
| `helpers/` | Shared plugin utilities (logging, KV store, session helpers) | camelCase filenames representing their domain |
| `types/` | TypeScript type definitions shared across modules | Descriptive singular or plural names (`instructions.ts`) |
| `sessions/` | Runtime JSON state files (1000+ files, auto-generated), contains plugin metadata, not actual sessions. | Pattern: `ses_<timestamp>_<random>.json` — do not create manually |
| `tests/` | Unit and integration tests for the plugin | Structure and file names map 1:1 to source files. eg. source file `tool-limit-reminder.ts` -> test file `tests/tool-limit-reminder.test.ts`. Same naming and folder structure with `tests/` directory and `.test.ts` suffix |

### Quality Gates

All these quality gates need to pass to conclude that the plugin is valid and ready for use.

Tests: `just opencode::test` (from repo root)
Linter: `just opencode::lint`
Typecheck: `just opencode::typecheck`

All commands support additional parameters eg. to run a single test file: `just opencode::test -- tests/helpers/instruction-indexer.test.ts`

### Technical Stack

Plugins ecosystem uses:
- TypeScript - language
- Vitest - test runner
- Bun - runtime
- eslint - linter
- tsc - typescript compiler

**Import style:** Plugin source files use relative imports (`./helpers/...`).
The `@plugins/*` and `@tests/*` aliases from `tsconfig.json` are for test files only.
See `.opencode/instructions/opencode-plugin-interfaces.instructions.md` for details.

### State machine plugin conventions

The session loop is a machine directory, `state-machine/machines/session/`, holding `machine.json`, `signals.manifest.json`, `definitions.ts` and `context.ts`; `definitions.ts` carries every action and guard body, the template texts, the signal codecs and the machine's own helpers, and `context.ts` carries the context shape, its defaults, the snapshot field allowlist and its limits. `state-machine/machines/index.ts` is the registry, where each entry carries `{ id, definition, manifest, transientStates, definitions, contexts }`, and the module also exports the default snapshot codec, the default state ids and the callback names. `state-machine/core/` holds the assembler (`core/machine.ts`) and the generic signal engine (`core/signals.ts`), plus generic infrastructure shared across machines, and defines no session field, state, signal, template, callback or machine id. A new machine is one directory under `state-machine/machines/` with `machine.json`, `signals.manifest.json`, `definitions.ts` and `context.ts`, plus one registry entry wiring all four — `core/` is not edited. These invariants came from live sessions and a unit-test suite that stayed green while the host did nothing; keep them when editing it. Edit rules for states, guards, actions, signals and snapshots: `.opencode/instructions/state-machine.instructions.md`.

- **The loop never speaks first.** A fresh session's entry emits are held on the machine and handed over by `wake()` on the first real user message; a state change before that drops them. Do not deliver `define_goal`'s prompt at `session.created` — the agent invents a goal from an empty chat.
- **Only waiting states reset.** `parked` and `panic` return to `define_goal` on a real user item. The active work state does not: the message that started the turn arrives after `SET_GOAL` and would wipe the goal mid-work. A new reset arm needs a reason the goal cannot be lost.
- **Idle is one root rule.** `system_idle` sits on the machine root and targets `validate` under the `not_parked` guard, so an idle from any working state reaches goal evaluation and an idle in `parked` changes nothing. Per-state idle arms, idle nudges and the `idle_park` and `state_follow_up` templates have no place here.
- **A user item opens the session first.** The message can be the first access after a hot reload; without an `ensure` the input reaches no machine and a `parked` session can never leave. `state-machine.ts` opens the session before it wakes or delivers the item.
- **One shape per host payload.** `session.inbox.enqueued` carries `data.item.type` and `data.item.payload.text`; read them through `core/inbox.ts` rather than a hand-rolled assumption, and mirror the same shape in the test harness.
- **Snapshots store keys, not prose.** `skill:<name>:complete` and `mem:<path>:complete|ref` are the memory markers; command results stay complete for workflows. Only goal text is capped.
- **The gate is `rug`-only and one message.** A block names the tool and the transition that leaves the state; a state with no rule allows. A block is `Tool.Error` with `metadata = { code: 'tool_blocked', tool, state, allowed_tools }`.
- **Signals are declared once and enabled by one slot.** `signals.manifest.json` holds each `describe` and schema; an entry action names its own `set_enabled_signals`, and `core/signals.ts` refuses a name the registry does not declare. Do not derive the list from state arms or a `stateId`.
- **Advertising is an action.** `update_signals_policy` emits `emit.signals` when it notifies the agent; the plugin sends a separate synthetic. Do not append availability to a prompt template.
- **A prompt names itself.** `prompt` carries a `description` declared with the action; the plugin sends it beside the synthetic. `promptDescription` falls back to `Sent synthetic message: <opening words>...` when an emit supplies none. Do not reintroduce a state-keyed description map.
- **Refusals are errors, acceptance is neutral.** `unknown_signal`, `unavailable_signal` and `invalid_payload` are `Tool.Error` with structured `metadata`; `Signal accepted.` is the only successful result text.
- **Prove a hook change with a live `rug` run.** See the plugin-hook section of `.opencode/instructions/live-verification.instructions.md`; unit fakes are not evidence about the host.
