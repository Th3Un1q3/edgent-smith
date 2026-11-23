---
id: opencode/state-machine/states-structure
type: entities
L0: "Contract part 4: machine shape — no final state, admission split, the compound towards_goal, parent raises, idle budget of three, root interruption and root skill callback."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
part_of: opencode/state-machine-contract
related: [opencode/state-machine/context, opencode/state-machine/states-round]
---

# Contract 4 — state structure

Part of mem:opencode/state-machine-contract; previous mem:opencode/state-machine/context; next mem:opencode/state-machine/states-round.

## 4. States and transitions — structure
- There is no final state; every transition is evented; there is no `after`.
- `admission` is the start state: it reads the session's identity, sends a `rug` session without a parent to `towards_goal` and every other session to `free_work`; `admit` makes the same split in an `always` arm guarded by `session_agent`, recording the identity.
- `towards_goal` is compound and holds the goal round: `define_goal`, `work`, `check`, `validate`, `memorize`, `retrospective`, `parked`, `panic`; `free_work` has no children.
- An arm declared on a compound state handles the event for every child, so `towards_goal`'s `on` carries `system_idle` and `reset_goal` once.
- A child that cannot move its parent raises an event: `parked` and `panic` answer `system_user_input` with `emit_parent({type: 'reset_goal'})`.
- The `reset_goal` arm clears `goal`, `intent`, `attempts` and `nudges` and targets `#session.towards_goal.define_goal`; the raise stays on the machine's internal queue, so the parent handles it in the same macrostep and one user message still produces one state change.
- `system_idle` is one arm on `towards_goal`, not a per-state arm: an idle in a working state prompts `idle_nudge` naming the active state, on a budget of three nudges per round; the fourth records `idle budget exhausted` and moves to `panic`.
- `parked` and `panic` declare empty `system_idle` arms, so an idle there neither changes state nor emits.
- The plugin holds nothing: every host idle is dispatched to the machine.
- `system_interrupted` → `parked` is a single arm on the machine root, guarded by "not already in `parked`", so `admission`, `define_goal`, `work`, `check`, `validate`, `memorize`, `retrospective` and `panic` all park on it, `panic` included, because taking control is not a failure; in `parked` the guard fails, so the event neither changes state nor emits.
- `session.execution.failed` is not an interruption and keeps the panic path.
- `callback.skill_ready` is handled once on the machine root, so an injection answered after its requesting state has exited still records its result and marks the skill.