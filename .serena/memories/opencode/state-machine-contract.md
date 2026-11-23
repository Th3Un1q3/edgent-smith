---
id: opencode/state-machine-contract
type: entities
L0: "Index of the session-loop contract in 10 parts with the vocabulary map: state ids, signals, emits, callbacks, actions, guards, ports; 141 normative rules."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
related: [opencode/state-machine/about, opencode/state-machine/layout-effects]
---

# State machine contract — index

The contract is normative and split by its own sections: the rule lives in its part, not here. Each part carries `part_of` back to this index and `mem:` links to its neighbours. Layout: `machines/session/` (definition, manifest, definitions, templates, context), `machines/index.ts` (registry), `core/` (assembler, signals, snapshot, policy), driven by `.opencode/plugins/state-machine.ts`.

## Parts
- Layout and effects, 13 rules — mem:opencode/state-machine/layout-effects
- Event vocabulary and templates, 12 rules — mem:opencode/state-machine/events
- Context and guards, 19 rules — mem:opencode/state-machine/context
- State structure, 12 rules — mem:opencode/state-machine/states-structure
- The goal round, 12 rules — mem:opencode/state-machine/states-round
- Actions, 16 rules — mem:opencode/state-machine/actions
- Ports and delivery, 16 rules — mem:opencode/state-machine/delivery
- Persistence and policy, 17 rules — mem:opencode/state-machine/persistence
- Reset and host effects, 13 rules — mem:opencode/state-machine/host-effects
- Decisions, 11 rules — mem:opencode/state-machine/decisions

## Vocabulary map
- States: `admission`, `towards_goal` {`define_goal`, `work`, `check`, `validate`, `memorize`, `retrospective`, `parked`, `panic`}, `free_work`.
- Signals (via `agent_sent_signal.*`): `SET_GOAL`, `CLAIM_WORK`, `GOAL_ACHIEVED`, `GOAL_INCOMPLETE`, `LESSON`, `RETROSPECTIVE_COMPLETE`.
- Emits: `prompt`, `subagent`, `shell`, `skill`, `memories`, `signals`, `command`; `emit.dispatch` is retired.
- Callbacks: `quality_check_ready`, `skill_ready`, `memories_ready`, `subagent_ready`.
- Host events: `system_idle`, `system_user_input`, `system_interrupted`.
- Actions: `prompt`, `update_signals_policy`, `spawn_subagent`, `record`, `run_shell`, `run_command`, `activate_skill`, `recall_memories`, `record_callback`, `mark_skill`, `set_tools_policy`, `admit_identity`, `emit_parent`.
- Guards: `field_present`, `counter_below`, `improvement_lesson`, `callback_ok`, `not_parked`, `session_agent`.
- Ports: `runShell`, `injectSkill`, `loadMemories`, `runSubagent`.