---
id: opencode/state-machine/about
type: entities
scope: about — navigation for parent scope opencode/state-machine, the split session-loop contract
L0: "opencode/state-machine: 10 contract parts plus the index memory opencode/state-machine-contract; all 141 normative rules."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
L0_table:
  - {id: opencode/state-machine-contract, L0: "Index of the contract: 10 parts, rule counts and the vocabulary map of states, signals, emits, callbacks, actions, guards, ports."}
  - {id: opencode/state-machine/layout-effects, L0: "Layout of machines/, machine index registry and core/, plus the three dispositions of an effect."}
  - {id: opencode/state-machine/events, L0: "Event vocabulary: agent_sent_signal.*, emit.*, callback.*, system_*, and the prompt-template rules."}
  - {id: opencode/state-machine/context, L0: "LoopContext fields with their writers, clearers and readers, and the six guards."}
  - {id: opencode/state-machine/states-structure, L0: "Machine shape: no final state, admission split, compound towards_goal, parent raises, idle budget, root interrupt."}
  - {id: opencode/state-machine/states-round, L0: "The goal round: entry actions and arms for define_goal through panic."}
  - {id: opencode/state-machine/actions, L0: "The action set and its params, ids and signature-policy behaviour."}
  - {id: opencode/state-machine/delivery, L0: "Ports, emit delivery order, the callback contract, judge spawn and host event wiring."}
  - {id: opencode/state-machine/persistence, L0: "Snapshot codec, record shape and read outcomes, restore rules, and the tool-policy gate."}
  - {id: opencode/state-machine/host-effects, L0: "User-message reset semantics and the host effects behind emits."}
  - {id: opencode/state-machine/decisions, L0: "Decisions: attempts, panic, parking, skills as events, state typing, derived signals, refusals, judge verdict."}
---

# opencode/state-machine — about

The session-loop contract is one subject split into 10 parts under the index mem:opencode/state-machine-contract, each within the 4000c ceiling. Read the index for the vocabulary map; read the part for a rule.