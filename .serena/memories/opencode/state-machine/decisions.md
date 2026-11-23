---
id: opencode/state-machine/decisions
type: entities
L0: "Contract part 10: the decisions behind the loop — attempts, panic, parking, skills as events, one import site, state typing, derived signals, refusals, advertising, judge verdict."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
part_of: opencode/state-machine-contract
related: [opencode/state-machine/host-effects, opencode/state-machine-contract]
---

# Contract 10 — decisions

Part of mem:opencode/state-machine-contract; previous mem:opencode/state-machine/host-effects; next mem:opencode/state-machine-contract.

## 12. Decisions
- An attempt is a `GOAL_INCOMPLETE` reaching `validate`: only that signal, under the limit, increments `attempts`; an idle increments `nudges` and adds no attempt; the fourth failure enters `panic` with `failure.reason = 'attempts exhausted'`.
- Panic is diagnostic: it is entered by attempts exhausted, a failed quality check, a failed judge verdict and the fourth idle of a round (`idle budget exhausted`); each arm records the reason before prompting; panic is not a dead end, a lesson retries and user input starts over.
- Parking replaces ending: an improvement lesson parks the loop, the summary is sent once, the next user input resets the round and returns to `define_goal`.
- Skills and memories are events, not local state; the context keeps only what came back, `injectedSkills` and `injected`.
- The loop renders what it remembers: `work` re-renders `memories` on every entry, and `record` caps the list at `memoryLimit`.
- One state library import site: `loadStateMachineLibrary` owns the dynamic `import('xstate')`; the rest of the module receives the library.
- The state surface is the library's own: states and transitions use `MachineConfig` and `TransitionConfig`, so an unknown event or a rejected arm key fails the typecheck; action and guard payloads stay local unions (`ActionSpec`, `GuardSpec`), because their bodies live in `machines/session/definitions.ts` and register through `createActions` and `createGuards`.
- Signals are derived per state: no state config carries a `signals` block; the table comes from the signals the state's `on` arms carry, described by the machine's `signals.manifest.json`, plus any set `update_signals_policy` enables; `validateSignal` enforces shape, vocabulary, declaration and payload; `assertSignalDeclarations` fails `createStateMachine` when a declaration and its transition arms disagree.
- Refusals are errors, acceptance is neutral: a refusal is `Tool.Error` with `message` and `metadata`; an accepted signal returns `Signal accepted.` and the next prompt carries the guidance.
- Advertising is explicit: `update_signals_policy` always emits `emit.signals` and the plugin sends a separate synthetic; undeclared `signal_keys` are omitted at render time; `TOOL_SIGNALS` lives in `core/signals.ts` and is re-exported by `core/machine.ts`.
- A judge child decides; the loop agent's self-report is the fallback: `validate`'s entry spawns a `judge` subagent (`reportTo` `subagent_ready`, 120 s) whose callback is the primary verdict, and prompts the loop agent for `GOAL_ACHIEVED` or `GOAL_INCOMPLETE` as the verdict path for a host with no subagent facility; a spawn that cannot start records its failed callback and leaves the session in `validate`.