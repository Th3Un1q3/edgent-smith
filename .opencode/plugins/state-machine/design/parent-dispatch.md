> **Historical design record.** Superseded by `CONTRACT.md` for anything it states about current behaviour; removed action ids appear here only as history, not as the current interface.

# Parent dispatch: inherited handlers and `emit_parent`

## 1. The model

**A parent is the nearest enclosing compound state. Inheritance is that state's `on` block, and it is the real JSON nesting level — not a machine-level block that every state inherits.**

The machine is not five flat states today: `towards_goal` is already compound with `define_goal`, `work`, `check`, `validate` and `memorize` beneath it, and it already carries one inherited arm (`system_idle`, `machine.json:64-72`). The five states at the root are `admission`, `towards_goal`, `parked`, `panic`, `free_work`. The model adds one compound (`waiting`) and uses the existing one; the root stays the widest parent, the site of the one arm that is genuinely global (`system_interrupted`, `machine.json:4-12`).

```json
{
  "id": "session",
  "initial": "admission",
  "on": {
    "system_interrupted": {
      "target": "#session.waiting.parked",
      "guard": { "type": "not_parked", "params": {} }
    }
  },
  "states": {
    "admission": { "always": [], "on": {} },
    "towards_goal": {
      "initial": "define_goal",
      "on": {
        "system_idle": {
          "target": "#session.towards_goal.validate",
          "guard": { "type": "not_parked", "params": {} }
        }
      },
      "states": { "define_goal": {}, "work": {}, "check": {}, "validate": {}, "memorize": {} }
    },
    "waiting": {
      "initial": "parked",
      "on": {
        "system_user_input": {
          "target": "#session.towards_goal.define_goal",
          "actions": []
        }
      },
      "states": {
        "parked": { "entry": [], "on": {} },
        "panic": { "entry": [], "on": {} }
      }
    },
    "free_work": { "on": { "system_interrupted": { "actions": [] } } }
  }
}
```

(Bodies omitted where unchanged; `actions: []` and `entry: []` stand in for the arms shown in §4 and §5.)

Why nesting and not a root block: the two duplications have different scopes, and a root `on` block cannot carry two scopes without a guard that enumerates the states it serves. That list is hand-maintained and fails open — a new waiting state added later silently stops resetting. Nesting fails closed: a child of `waiting` inherits the reset by being a child. The root is still available as a parent for the case where global is correct, and `system_interrupted` is that case.

### What assembly must do

1. **Nothing for a plain inherited arm.** The library resolves an event from the leaf upward at send time; `machine.json` reaches it unmodified, and `withoutSignals` (`core/machine.ts:327-340`) already clones nested states recursively, so `waiting` passes through whole.
2. **`assertTargets` covers the new node for free** (`stateEntriesOf` recurses, `core/machine.ts:430-439`), but it starts at `definition.states` and never walks the root `on`. A hoist onto a real parent therefore gets its targets validated; a hoist onto the root does not. That is a second reason to hoist onto `waiting`.
3. **`declaredPolicyParameters` must recurse** (`machines/session/definitions.ts:417-437` reads one level only). Today nothing breaks when `panic` nests, because `LESSON` is declared in `signals.manifest.json:43-66` and `createSignalRegistry` registers every manifest signal first — but a nested `update_signals_policy` naming an ad-hoc alias would then never reach the registry. Fix the walk in the same change.
4. **No type change.** `towards_goal` already proves a compound state is representable in `LoopState` (`core/machine.ts:125-134`), and `hasTarget` resolves `#session.waiting.parked` from `statePathsOf`.

## 2. Resolution rules

- **Precedence.** Nearest declaration wins: a child that declares the same event key shadows its parent, and the parent's arm does not run for that event while the child is active.
- **No handler anywhere.** The event is dropped by the library — no error, no state change, no emit. `free_work` relies on that today for every event it does not list.
- **Opt-out.** A state opts out of an inherited arm by declaring the same key with `actions: []` — the idiom already in the tree at `machine.json:562-566`, where `free_work` shadows the root's park arm.
- **Scope is the declaration site, not a flag.** Inheritance is global per key *below the declaring state*; there is no per-event opt-in switch. `parked` and `panic` are inside `waiting`, so they inherit it; `free_work` is not, so it does not.

## 3. `emit_parent({type})`

**It is an assembly directive, not an `EmitRequest`.** Adding it to the outward channel would need the host to send the event back, and `dispatch(entry, event)` would need a re-entrant loop for something that never leaves the actor.

```json
{ "type": "emit_parent", "params": { "type": "system_user_input" } }
```

- **Shape.** `params.type` is an event key, not a state id: the action names the arm to borrow, never the state to borrow it from.
- **Resolution point.** `resolveParentActions(definition)`, a new pass inside `assembleMachine` (`core/machine.ts:499-521`), running after `assertTargets` and before the `WeakMap` write. For each `emit_parent` item it walks the emitting state's ancestors by dotted path, takes the nearest one whose `on[type]` exists, and splices that arm's `actions` into the child's list where the item sits. The child's own `target` and its other actions survive.
- **No ancestor declares `type`.** Assembly throws. JSON is untyped and an action id nothing registers fails only at assembly today; a borrow of an arm that does not exist must fail at the same point rather than silently doing nothing.
- **No parent.** Unrepresentable in practice — every state is under the root, and the root's `on` is an ancestor arm like any other. The root itself cannot contain the item, because it has no ancestor.
- **Transition or mutation?** Mutation only. The referenced arm must be targetless; a `target` on it is an assembly error, and so is a `guard` (v1 refuses rather than inventing conditional enqueueing) and an array of guarded arms.
- **It has no user in this machine.** After the two hoists in §4 and §5, both duplications are served by plain inheritance, because their arms already share one target. Adding the id now would repeat the defect P1 removes — `request_dispatch` is declared, typed and reached by no arm. It lands with its first user, and the name is `emit_parent` only because it is the request's word: nothing is emitted.

The case it exists for: a child that needs its own target but the parent's mutation. It would read `{ "target": "...", "actions": [{ "type": "emit_parent", "params": { "type": "reset_round" } }] }` — and the parent would hold that mutation under a key the child does not shadow. No arm in `machine.json` needs it today.

## 4. The reset duplication, replaced

`parked` (`machine.json:433-472`) and `panic` (`:521-559`) each declare `system_user_input` with the same target and the same three `record` items, six items in total. One arm on `waiting` replaces them:

```json
"waiting": {
  "initial": "parked",
  "on": {
    "system_user_input": {
      "target": "#session.towards_goal.define_goal",
      "actions": [
        { "type": "record", "params": { "op": "set", "key": "goal", "source": { "from": "literal", "value": "" } } },
        { "type": "record", "params": { "op": "set", "key": "intent", "source": { "from": "literal", "value": "none" } } },
        { "type": "record", "params": { "op": "set", "key": "attempts", "source": { "from": "literal", "value": 0 } } }
      ]
    }
  },
  "states": {
    "parked": {
      "entry": [
        { "type": "prompt", "params": { "template": "park_summary", "description": "Report the reached goal and the improvements recorded." } }
      ],
      "on": {}
    },
    "panic": {
      "entry": [
        { "type": "update_signals_policy", "params": { "set_enabled_signals": ["LESSON"] } }
      ],
      "on": { "agent_sent_signal.LESSON": "…unchanged, machine.json:486-519…" }
    }
  }
}
```

**The children have no arms to raise it.** Inheritance replaces raising: `parked.on` and `panic.on` lose `system_user_input` and keep everything else; the parent arm is the only copy. That is why `emit_parent` is not needed here — both children already share the target.

Behaviour is unchanged, including order: transition actions run before the target's entry actions, so the reset still precedes everything `define_goal` prints, exactly as the per-state arms did.

Six paths follow `parked` and `panic` one level down:

| site | today | after |
|---|---|---|
| root `system_interrupted` (`:6`) | `#session.parked` | `#session.waiting.parked` |
| `check`, check failed (`:234`) | `#session.panic` | `#session.waiting.panic` |
| `validate`, attempts exhausted (`:324`) | `#session.panic` | `#session.waiting.panic` |
| `memorize`, improvement lesson (`:377`) | `#session.parked` | `#session.waiting.parked` |
| `parked.system_user_input` (`:435`) | `#session.towards_goal.define_goal` | deleted; the arm moves to `waiting` |
| `panic.system_user_input` (`:522`) | `#session.towards_goal.define_goal` | deleted; same arm |

`not_parked` (`definitions.ts:588`) is `runtime.stateIn('parked')` and must test the compound value now. The exact accepted argument form (`{ waiting: 'parked' }` or a dotted id) follows the installed library's `stateIn` state-value contract — not visible from the tree; verify at implementation.

## 5. The `memories_ready` lift

`define_goal` (`machine.json:136-146`) and `work` (`:193-203`) carry byte-identical arms. `towards_goal.on` gains one key and both child arms are deleted:

```json
"towards_goal": {
  "initial": "define_goal",
  "on": {
    "system_idle": {
      "target": "#session.towards_goal.validate",
      "guard": { "type": "not_parked", "params": {} }
    },
    "callback.memories_ready": {
      "actions": [
        { "type": "record_callback", "params": { "reportTo": "memories_ready", "key": "preferences/user" } }
      ]
    }
  }
}
```

No target, no guard, no new state, no path change: the smallest change in this design.

## 6. The `dispatch` seam

`dispatch(entry, event)` (`core/machine.ts:891-895`) sends one event, clears the held entry emits, and drains what the actor emitted. **Neither inheritance nor `emit_parent` adds a step to it.** Inheritance is resolved by the library inside `actor.send`; `emit_parent` is resolved once, statically, by `resolveParentActions` during assembly. `dispatch` stays a single send, and `takeEmits` never sees a parent event.

## 7. Behaviour risk

Declaring a handler on a parent makes it fire in states that did not declare it — P7's hazard, generalised.

- **Inheritance is global per key below the declaring state, not opt-in per event**, and a state opts out by shadowing the key with `actions: []`.
- `callback.memories_ready` at `towards_goal` now reaches `check`, `validate` and `memorize`, which have no memories request outstanding. Those states have no arm for it, so it records and does not transition — but `record_callback` writes `failure` when `payload.ok` is false (`definitions.ts:307-320`), so a late failed read landing in `validate` leaves a stale `failure` that `panic_escalation` and `quality_check_failed` will print as the reason. "It only records" is not the whole risk.
- `system_user_input` at the root would have wiped the goal mid-work in `define_goal`, `work`, `check`, `validate` and `memorize`, against the "only waiting states reset" rule. Hoisting it to `waiting` is what keeps that rule true; the declaration site *is* the risk control.
- The structural cost of `waiting` is a stored-snapshot break: a session persisted in `parked` restores with a path `hasStatePath` rejects (`core/machine.ts:833-842`), so it comes back `shape-invalid` and starts fresh at `admission`. `stateLeaf` still displays `parked`.
- Do not hoist an `agent_sent_signal.*` arm: `acceptedTransitions` (`core/machine.ts:533-537`) and the coarse policy derivation read only the state that declares the key.

## 8. What CONTRACT.md gains

Draft, five sentences, for a new §4a after the states table:

> An `on` key declared on a compound state serves every state below it: the state library resolves an event from the leaf upward and the nearest declaration wins, so a child that declares the same key shadows its parent and the parent's arm does not run. Scope is the declaration site — `towards_goal` for the arms every goal-round state shares, `waiting` for the reset `parked` and `panic` share, the machine root for the one arm every state shares — and a state opts out by declaring the key with an empty `actions` list, as `free_work` does for `system_interrupted`. `emit_parent({type})` is an assembly-time splice rather than an emit: it copies the nearest ancestor's arm for `<type>` into the child's action list at the item's position, actions only, so a child keeping its own target still runs the shared mutation, and it fails assembly when no ancestor declares `<type>` or the borrowed arm carries a `target` or a `guard`. An inherited arm may not carry `update_signals_policy` or an `agent_sent_signal.*` key, because the registry scan and `acceptedTransitions` read only the declaring state. Delivery widens to every child on purpose: `callback.memories_ready` now reaches `check`, `validate` and `memorize`, which record it and never transition.

## 9. Migration

**Additions can land before the deletions, but the two halves belong to one commit and the additions must be written first.**

- Adding the parent arm while the child arms still exist is a no-op: the children shadow it. Nothing double-fires, so there is no window in which the reset runs twice.
- Deleting the child arms before the parent arm exists is not recoverable in-place: a user item in `parked` matches nothing and the session never leaves. For `memories_ready` the failure is quieter — `define_goal` silently stops injecting `preferences/user` into `work`.
- The `waiting` node itself cannot be split: nesting without the six path rewrites targets states that no longer exist, and `assertTargets` fails at assembly. That is one JSON edit, not a migration.

So: **inheritance lands first as a no-op, its proof is the deletion, and both are one commit per duplication.** The reset and the `memories_ready` lift are independent of each other and of P6 (`reset_round`) — but P6 rewrites the same three records, so if P6 lands first the parent arm holds one item; if it lands second, the hoist holds three and P6 edits one line. Either order is correct; the hoist-then-P6 order produces the smaller second diff.

The snapshot break is the one thing a revert does not undo for a session already restored: it returns to `admission` with a fresh context, which loses the goal. Reverting the commit restores `parked` as a path but not a session that already reset.

## 10. Smallest first slice

**Lift `callback.memories_ready` in §5 and nothing else.** It uses the existing parent, adds no state, changes no target, no guard and no path, and deletes exactly the two arms the audit calls byte-identical.

- Gate: `just opencode:test` green, then one live `rug` run whose `[state-machine]` lines show memories arriving while the machine is in `work` — the same session that already proved P8/P9.
- It proves the mechanism the reset depends on (an arm declared once, firing in children that declare nothing) and it proves the widening at the same time, so a rejection of §5 does not invalidate §4.
- It cannot be the reset: that slice needs `waiting`, the six path rewrites and the snapshot break, so it is the second slice, not the first.

## 11. Forks a user must settle

1. **Does `waiting` nest at all?** Nesting costs six target rewrites, one guard body and a snapshot break for sessions parked on upgrade, and buys fail-closed scoping. The alternative — root `system_user_input` under a new `state_in({in: ['parked','panic']})` guard — costs no path change but fails open.
2. **Does `emit_parent` ship now or with its first user?** No arm needs it after the hoists; shipping it now adds a twelfth action id that nothing names.
3. **Is the widened `memories_ready` delivery accepted**, including the stale-`failure` write on a failed late read? If not, the parent arm needs `state` scoping, which this model does not have.
4. **Does P6 (`reset_round`) land before the reset hoist?** Semantics are identical either way; only the diff size differs.

## 12. Not visible from the tree

- Which argument form the installed `stateIn` accepts for a compound value.
- Whether `towards_goal.system_idle` (`:64-72`) is the intended site: `CONTRACT.md:82-84` and `.opencode/plugins/AGENTS.md` both describe `system_idle` as sitting on the machine root, and the root `on` (`:4-12`) carries only `system_interrupted`. Both readings produce the same idle behaviour, so this design does not depend on which is right — but the drift is real and should be corrected either way.

## 13. Scope

This stage designs. It does not patch: no code, no `machine.json`, no contract, no test changed by it. Every count in it is read from the tree at the revision above — 11 action ids in `ACTION_TYPES` (`definitions.ts:146-158`), five root states, `record` carrying `op: 'fail'` and `set_tools_policy` carrying `allowedTools: null`.
