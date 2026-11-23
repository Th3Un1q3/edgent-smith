---
id: opencode/state-machine/layout-effects
type: entities
L0: "Contract part 1: machine layout (machines/, core/, registry) and the three dispositions of an effect: state-only assign, emit without answer, emit with callback."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
part_of: opencode/state-machine-contract
related: [opencode/state-machine/events]
---

# Contract 1 — layout and effects

Part of mem:opencode/state-machine-contract; next mem:opencode/state-machine/events.

## Layout
- `machines/session/` holds `machine.json` (definition), `signals.manifest.json` (signal declarations), `definitions.ts` (action and guard bodies, template values, signal codecs, machine helpers), `templates/` (prompt wording), `context.ts` (context shape, defaults, snapshot field allowlist, limits).
- `machines/index.ts` is the registry (`MachineModule`, `MACHINES`, `DEFAULT_MACHINE`); each entry carries `{ id, definition, manifest, transientStates, definitions, contexts }`; it also exports the default snapshot codec, the default state ids and the callback names.
- `core/` holds the assembler `core/machine.ts`, the generic signal engine `core/signals.ts` and generic infrastructure; `core/` defines no session field, state, signal, template, callback or machine id.
- The driving plugin is `.opencode/plugins/state-machine.ts`.
- A new machine is a directory under `machines/` with `machine.json`, `signals.manifest.json`, `definitions.ts`, `context.ts`, plus one registry entry wiring all four; `core/` is never edited to add a machine.
- `.opencode/plugins/tests/state-machine.test.ts` holds the same claims.

## 1. Effects have three dispositions
- State only: a pure `assign` (set the goal, increment an attempt, push a lesson); no event, no callback.
- Outbound, no answer: `prompt` emits and the plugin turns the emit into a synthetic message; the reply arrives later as an ordinary agent signal.
- Outbound, answer required (shell run, skill injection, memory read): the action emits, the plugin performs the work and sends `callback.<name>` back; the callback arm records the payload in context and later arms read it.
- Dispositions 2 and 3 share one mechanism, an `emit` the plugin observes, and differ only in whether a callback is expected.
- The actor never performs I/O and never blocks.
- Guards run before a transition's actions, so a guard cannot read a value its own arm is about to record.
- `callback_ok` tests the callback event's `payload.ok`; `record_callback` stores the same payload for later arms and diagnostics.