> **Historical design record.** Superseded by `CONTRACT.md` for anything it states about current behaviour; removed action ids appear here only as history, not as the current interface.

# Parent raise: `reset_goal`, `emit_parent`, and the goal-round compound

## 1. The engine

`xstate` 5.33.4, pinned as `dependencies.xstate` in `.opencode/package.json`. There is no `package.json` in the plugin directory: the plugin is a directory of modules under `.opencode/plugins/`, not a package.

The engine is XState itself, not a custom interpreter. `loadStateMachineLibrary` in `core/machine.ts` performs the module's only dynamic `import('xstate')`, destructures `assign, emit, enqueueActions, not, stateIn`, wraps them in `setup({ types, actions, guards })`, and creates actors with `machine.createMachine(...)` plus `createActor`. The types confirm it: `NativeLoopConfig` is `MachineConfig<...>` and `LoopArm` is `TransitionConfig<...>`, both imported from `xstate`.

Three layers sit above the library and constrain what the JSON may say. `assembleMachine` clones the definition, strips the `signals` metadata, and runs `assertTargets`; `stateLeaf` and `stateValuePath` in `core/signals.ts` flatten a compound value to a leaf for display and a dotted path for storage; `snapshotCodec` in `machines/session/context.ts` allowlists the persisted context fields. None of them interprets events. Event handling, state entry and exit, guard selection and event queuing are XState's.

### What this machine uses, and what it does not

| Behaviour | Present? | Grounding |
|---|---|---|
| Compound states with an `initial` child | yes | `states.towards_goal.initial = "define_goal"`; `LoopState` is `NativeStateConfig` with `states` |
| Event resolution from the leaf upward | yes | `transitionAtomicNode` tries `childStateNode.next(snapshot, event)` and only falls back to `stateNode.next(snapshot, event)`; `transitionCompoundNode` recurses into the active child before asking the compound |
| `raise` on an internal queue, same macrostep | yes (unused today) | `dist/declarations/src/actions/raise.d.ts`: "places the event in the internal event queue, so that the event is immediately consumed by the machine in the current step"; `macrostep` drains `internalQueue` inside its `while` loop and only breaks when the queue is empty |
| `raise` available inside `enqueueActions` | yes | `dist/declarations/src/actions/enqueueActions.d.ts` exposes `raise: (...args: Parameters<typeof raise<...>>) => void` on the enqueue object and imports it from `./raise.js` |
| `always` eventless transitions | yes | `selectEventlessTransitions` walks each atomic state then its proper ancestors; used once, by `states.admission.always` |
| `stateIn` as a guard | yes, with a trap | `checkStateIn` treats a `#`-prefixed string as a state id via `getStateNodeById`, and any other string through `snapshot.matches(stateValue)`, which compares the whole state value |
| Parallel states | no | no `type: "parallel"` in `machine.json` |
| History states | no | none declared |
| Invoked child actors | no | no `invoke` in `machine.json`; `stopChildren` therefore iterates an empty `children` |
| Delays, `after`, timers | no | no `after` key anywhere; the loop is evented only |
| `sendTo` to another actor | not applicable | there is one actor; the plugin delivers outbound effects through `emit.*` and its own ports |

### What the parent can do to a child

XState gives a parent handler exactly three dispositions over the child that raised an event:

1. **Run actions only.** `{ "actions": [...] }` with no `target` is a transition that runs its actions and leaves the configuration untouched: the raising child is not exited.
2. **Exit the child into a sibling.** A `target` that names another child of the same compound makes the least common ancestor the compound itself, so the compound is not exited, the raising child is exited and the sibling is entered with its entry actions. Within one `microstep` the order is exit, then the transition's actions, then entry (`exitStates`, then `resolveActionsAndContext` on the transition's actions, then `enterStates`).
3. **Stop it.** Not available here. `stopChild` applies to entries in `snapshot.children`, which only invoked actors create; this machine invokes none. A nested state cannot be paused, only exited.

Context is one object for the whole actor, not one per state. A parent's `assign` and a child's `assign` write the same record, so the parent handler's value is a single declaration site, not a different data scope.

### Why a child cannot transition its parent

A child's target is resolved to a state node, and the exit set is computed from the least common ancestor of the current configuration and the target. A child that targets its parent's sibling exits itself; a child that stays inside itself cannot move its parent. Selection is also ordered: a child that declares `on.<type>` shadows the same key on every ancestor (`transitionAtomicNode` asks the child first and returns as soon as it has a transition), so a parent arm is reached only for an event type no active child declares.

That shadowing is the constraint this design turns into a mechanism: the host's `system_user_input` is declared by the two waiting children, so no parent arm for `system_user_input` can ever see it there. A second event type, declared by nobody below the parent, can.

## 2. Hierarchy

`towards_goal` is the goal-round compound. Everything that owns a goal round is its child; the states that exist before a goal and outside a goal stay at the root.

- Root: `admission`, `towards_goal`, `free_work`.
- Children of `towards_goal`: `define_goal`, `work`, `check`, `validate`, `memorize`, `parked`, `panic`.
- Kept, unchanged id and path: `admission`, `towards_goal`, `towards_goal.define_goal`, `towards_goal.work`, `towards_goal.check`, `towards_goal.validate`, `towards_goal.memorize`, `free_work`.
- Moved: `parked` and `panic`, from root to `towards_goal.parked` and `towards_goal.panic`. Their leaf names are unchanged, so `Actor.state()` still reports `parked` and `panic`.
- Added: no state id. One arm, `states.towards_goal.on.reset_goal`, and one action id, `emit_parent`.
- Removed: no state id. Six `record` items (§5) and one `on` arm (§6).

Rejected: a second compound `waiting` wrapping `parked` and `panic`. It would let one `system_user_input` arm serve both, but it adds a path level (`towards_goal.waiting.parked`), another `stateIn` trap of the same kind as the one below, and it re-creates the duplication it removes — the raise already collapses the two arms into one handler.

### Skeleton

Abbreviated entry and guard payloads are marked `…`; every state id, every `on` key that changes, and the two new arms are complete.

```json
{
  "id": "session",
  "initial": "admission",
  "on": {
    "system_interrupted": {
      "target": "#session.towards_goal.parked",
      "guard": { "type": "not_parked", "params": {} }
    },
    "callback.skill_ready": {
      "actions": [
        { "type": "record_callback", "params": { "reportTo": "skill_ready" } },
        { "type": "mark_skill", "params": { "from": "payload" } }
      ]
    }
  },
  "states": {
    "admission": {
      "always": [
        { "guard": { "type": "session_agent", "params": { "in": ["rug"] } }, "target": "#session.towards_goal" },
        { "target": "#session.free_work" }
      ],
      "on": {
        "admit": [
          { "guard": { "type": "session_agent", "params": { "in": ["rug"] } }, "target": "#session.towards_goal", "actions": [{ "type": "admit_identity", "params": {} }] },
          { "target": "#session.free_work", "actions": [{ "type": "admit_identity", "params": {} }] }
        ]
      }
    },
    "towards_goal": {
      "initial": "define_goal",
      "on": {
        "system_idle": {
          "target": "#session.towards_goal.validate",
          "guard": { "type": "not_parked", "params": {} }
        },
        "reset_goal": {
          "target": "#session.towards_goal.define_goal",
          "actions": [
            { "type": "record", "params": { "op": "set", "key": "goal", "source": { "from": "literal", "value": "" } } },
            { "type": "record", "params": { "op": "set", "key": "intent", "source": { "from": "literal", "value": "none" } } },
            { "type": "record", "params": { "op": "set", "key": "attempts", "source": { "from": "literal", "value": 0 } } }
          ]
        }
      },
      "states": {
        "define_goal": { "entry": ["…"], "exit": ["…"], "on": { "agent_sent_signal.SET_GOAL": { "target": "work", "actions": ["…"] }, "callback.memories_ready": { "actions": ["…"] } } },
        "work": { "entry": ["…"], "on": { "agent_sent_signal.CLAIM_WORK": { "target": "check" }, "callback.memories_ready": { "actions": ["…"] } } },
        "check": { "entry": ["…"], "on": { "callback.quality_check_ready": ["…"] } },
        "validate": { "entry": ["…"], "on": { "agent_sent_signal.GOAL_ACHIEVED": { "target": "memorize", "actions": ["…"] }, "agent_sent_signal.GOAL_INCOMPLETE": ["…"] } },
        "memorize": { "entry": ["…"], "on": { "agent_sent_signal.LESSON": [
          { "target": "#session.towards_goal.parked", "guard": { "type": "improvement_lesson", "params": {} }, "actions": ["…"] },
          { "target": "work", "guard": { "type": "field_present", "params": { "field": "text" } }, "actions": ["…"] }
        ] } },
        "parked": {
          "entry": [{ "type": "prompt", "params": { "template": "park_summary", "description": "Report the reached goal and the improvements recorded." } }],
          "on": {
            "system_user_input": { "actions": [{ "type": "emit_parent", "params": { "type": "reset_goal" } }] }
          }
        },
        "panic": {
          "entry": [{ "type": "update_signals_policy", "params": { "set_enabled_signals": ["LESSON"] } }],
          "on": {
            "agent_sent_signal.LESSON": [{ "target": "#session.towards_goal.work", "guard": { "type": "field_present", "params": { "field": "text" } }, "actions": ["…"] }],
            "system_user_input": { "actions": [{ "type": "emit_parent", "params": { "type": "reset_goal" } }] }
          }
        }
      }
    },
    "free_work": {
      "on": { "system_interrupted": { "actions": [] } }
    }
  }
}
```

Three path rewrites ride with the move: the root `system_interrupted` target, `memorize`'s improvement target, and both `check`/`validate` targets into panic. The skeleton shows the first two; `states.towards_goal.check.on["callback.quality_check_ready"]` and the `GOAL_INCOMPLETE` fallback arm likewise change `#session.panic` to `#session.towards_goal.panic`.

One guard must change with them. `not_parked` is `runtime.not(runtime.stateIn('parked'))` in `createGuards`. `checkStateIn` resolves a string that is not a state id through `snapshot.matches('parked')`, which compares the whole state value; with `parked` nested the value is `{ towards_goal: 'parked' }`, so the comparison is false, the guard is always true, and an interruption in `parked` would re-enter `parked` and send a second `park_summary`. It becomes `runtime.not(runtime.stateIn('#session.towards_goal.parked'))`, which `checkStateIn` resolves through `getStateNodeById`. `system_idle`'s arm carries the same guard and inherits the fix.

The new parent arm must use the absolute target, not `.define_goal`. `hasTarget` in `core/machine.ts` resolves a dot-relative target against `parentPath(path)`, and `parentPath('towards_goal')` is `''` because a top-level path has no dot, so `.define_goal` would be checked as `define_goal` and `assertTargets` would reject it. `#session.towards_goal.define_goal` is checked against the declared path set and passes.

## 3. The event: `reset_goal`

**Trigger source.** `states.towards_goal.parked.on.system_user_input` and `states.towards_goal.panic.on.system_user_input`, both delivered by `StateMachine.userInput(sessionId, text)` in `core/machine.ts`, which the plugin calls from `session.inbox.enqueued` for a real user item only.

**Raised, not sent.** The child arm carries one `emit_parent` action and no target. It is handled by `states.towards_goal.on.reset_goal`.

**Guard: none.** The arm is unguarded. A guard would have to test that the raiser is a waiting child, and the raise site already is that test; two copies of one condition drift, and the second copy cannot be exercised except by removing the first. The invariant is enforced by a test instead: `reset_goal` appears in exactly two arms in `machine.json`, both `system_user_input` under `towards_goal`.

**Unreachable from the host.** `reset_goal` is not in the `LoopEvent` union as a host event, `signal_send` prefixes its `type` into `agent_sent_signal.<TYPE>`, and the only `send` sites are `signal`, `callback`, `userInput`, `interrupted` and `idle`. No entry point can carry it, so the parent arm is reachable only through the internal queue.

**Effect on loop context.** The three `record` items moved from `parked` set `goal` to `""`, `intent` to `none` and `attempts` to `0`. Nothing else is written: `memories`, `improvements`, `injectedSkills`, `injected`, `results`, `policy`, `signalsPolicy` and `failure` survive, which is the reset the current arms perform and the one CONTRACT.md §10 describes.

**Effect on the raising child.** It exits. The arm's target is a sibling under the same compound, so `parked` or `panic` is exited, `towards_goal` is not, and `towards_goal.define_goal` is entered with its entry actions: `prompt` the goal request, `update_signals_policy` to `SET_GOAL`, `recall_memories` for `preferences/user`, `set_tools_policy` to reinstall the gate. The observable result is today's: one user message in `parked` produces the goal request, and the tool gate is back.

**Ordering.** The child's arm runs first, in the current configuration; the raised event is taken from `internalQueue` only after that microstep, and the parent's transition then runs its three `record` actions before `define_goal`'s entry actions (`microstep`: exit, then transition actions, then entry). So the reset lands before anything in `define_goal` reads the context, and the whole exchange is one `actor.send`. `dispatch` in `core/machine.ts` sends once, clears the held emits, and drains once: the plugin gains no step, no port, and no new callback.

**No cycle.** The only raiser is a `system_user_input` arm of a waiting child, and the reset enters `define_goal`, whose entry raises nothing, so the macrostep terminates after two microsteps. Raising from an entry action of the reset's own target would loop; nothing in the tree does.

## 4. The raising action: `emit_parent({type})`

**Parameter shape.**

```json
{ "type": "emit_parent", "params": { "type": "reset_goal" } }
```

`parameters.type` is the event type to raise, a string. `params.type` is not validated against `LoopEvent` at the JSON boundary; see the assembly check below.

**A separate action id, not a parameterised form of an existing one.** The eleven ids in `ACTION_TYPES` split into three families: `prompt`, `run_shell`, `activate_skill`, `recall_memories` and `request_dispatch` are `emit.*` outbound effects the plugin performs; `record`, `record_callback`, `mark_skill`, `set_tools_policy` and `admit_identity` are `assign` mutations; `update_signals_policy` is both. None of them queues an event. `emit_parent` is a fourth disposition — internal event — so it needs its own id, its own `ActionSpec` member, its own `ACTION_TYPES` entry, and its own parameters interface in `machines/session/definitions.ts`.

**Body.** The `enqueueActions` form needs no change to `core/machine.ts`'s runtime object, because `enqueue.raise` is already on the enqueue object that `runtime.enqueueActions` passes in:

```ts
interface EmitParentArguments {
  readonly enqueue: { raise(event: { readonly type: string }): void }
}

emit_parent: runtime.enqueueActions(({ enqueue }: EmitParentArguments, parameters: EmitParentParameters) => {
  enqueue.raise({ type: parameters.type })
}),
```

This mirrors the existing `SignalsPolicyArguments` and `SkillArguments` partial interfaces, which name only the members their body reads. The alternative, `runtime.raise((_args, parameters) => ({ type: parameters.type }))`, needs `raise` added to the `XStateRuntime` Pick and to the destructuring in `loadStateMachineLibrary` — two core edits for the same behaviour. Fork F1.

**Why this is the mechanism.** A child cannot move its parent, so it queues an event the parent declares. In XState terms that is `raise`, not `send`: `raise` pushes onto the `internalQueue` that `macrostep` drains before it returns, so the parent's arm runs in the same macrostep as the child's arm, with no extra `actor.send` and no extra emit drain. `sendTo` would route through an actor's mailbox and start a new macrostep — and there is no parent actor to address: the machine is one actor, and the parent is a state node in the same snapshot. (The `sendTo` contrast is XState-only: no `sendTo` call exists in this tree and no invoked actors exist, so this engine does not exercise it.)

**No-handler behaviour: silent drop.** If no ancestor declares `on.<type>`, `selectTransitions` returns no transitions for the queued event, `microstep` leaves the snapshot unchanged, and `macrostep` drains the rest of the queue and returns. No error, no state change, no emit. A typo in `params.type` therefore turns a reset into a state that ignores the user message forever, which is the one failure mode worth spending an assembly check on.

**Assembly check.** `assertTargets` already walks every state with its dotted path and every arm through `armsOf`, inside `assembleMachine`. A sibling pass asserts that each `emit_parent` item's `params.type` is an `on` key of at least one proper ancestor of the emitting state, and throws otherwise, in the same voice as `targets <x>, which it does not declare`. That keeps the check machine-agnostic and moves the failure from a live session to assembly.

**Type prerequisite.** `setup` types events as `LoopEvent`, so `on.reset_goal` and the raised payload both fail the typecheck until `LoopEvent` in `core/machine.ts` gains `{ readonly type: 'reset_goal' }`. That one union member is the whole core event change; `LoopOn` is keyed off `NativeTransitions`, so the parent arm then typechecks and a misspelled key fails.

## 5. Duplication retired

The reset exists twice, once per waiting child, as three `record` items each.

**Before**, `states.parked.on.system_user_input.actions` and `states.panic.on.system_user_input.actions` are identical:

```json
{
  "system_user_input": {
    "target": "#session.towards_goal.define_goal",
    "actions": [
      { "type": "record", "params": { "op": "set", "key": "goal", "source": { "from": "literal", "value": "" } } },
      { "type": "record", "params": { "op": "set", "key": "intent", "source": { "from": "literal", "value": "none" } } },
      { "type": "record", "params": { "op": "set", "key": "attempts", "source": { "from": "literal", "value": 0 } } }
    ]
  }
}
```

**After**, each child keeps one action and no target, and the parent owns the mutation once:

```json
{
  "states": {
    "towards_goal": {
      "on": {
        "reset_goal": {
          "target": "#session.towards_goal.define_goal",
          "actions": [
            { "type": "record", "params": { "op": "set", "key": "goal", "source": { "from": "literal", "value": "" } } },
            { "type": "record", "params": { "op": "set", "key": "intent", "source": { "from": "literal", "value": "none" } } },
            { "type": "record", "params": { "op": "set", "key": "attempts", "source": { "from": "literal", "value": 0 } } }
          ]
        }
      },
      "states": {
        "parked": { "on": { "system_user_input": { "actions": [{ "type": "emit_parent", "params": { "type": "reset_goal" } }] } } },
        "panic":  { "on": { "system_user_input": { "actions": [{ "type": "emit_parent", "params": { "type": "reset_goal" } }] } } }
      }
    }
  }
}
```

Six `record` items become three, and two copies of the target become one. Arms that survive unchanged: `parked.entry` (the `park_summary` prompt), `panic.entry` (`update_signals_policy` to `LESSON`), and `panic.on["agent_sent_signal.LESSON"]`, whose `attempts` reset is a different reset — a retry that keeps the goal and the intent and must not be folded into `reset_goal`.

## 6. The skill callback lift

`activate_skill` emits `emit.skill` with `reportTo: "skill_ready"` from whichever state's entry names it, and the plugin answers with `callback.skill_ready` after the injection, asynchronously. Today only `states.towards_goal.work.on["callback.skill_ready"]` answers it. Two things break that: a state that activates a skill and exits before the callback arrives has no arm left, and `activate_skill`'s absence check reads `context.injectedSkills`, which only `mark_skill` writes — so a dropped callback makes the same skill re-emit on every re-entry, forever.

**Before**, the only arm:

```json
{
  "work": {
    "on": {
      "callback.skill_ready": {
        "actions": [
          { "type": "record_callback", "params": { "reportTo": "skill_ready" } },
          { "type": "mark_skill", "params": { "name": "task-delegation" } }
        ]
      }
    }
  }
}
```

**After**, one arm on the machine root, deleted from `work`:

```json
{
  "on": {
    "callback.skill_ready": {
      "actions": [
        { "type": "record_callback", "params": { "reportTo": "skill_ready" } },
        { "type": "mark_skill", "params": { "from": "payload" } }
      ]
    }
  }
}
```

**Why the root and not `towards_goal`.** A callback is answered by whatever state the session is in when it arrives, not by the state that asked. An injection started in `work` can be answered while the session is in `check`, `validate` or `parked` — and `parked` sits under `towards_goal`, so lifting to `towards_goal` would still drop the callback the moment an interruption parks the loop mid-injection. The root also covers `admission` and `free_work`, where nothing activates a skill today but where a late callback from a previous round can still land. The user's "lift it to the top of the machine" is the root.

**Arms that disappear.** Exactly one: `states.towards_goal.work.on["callback.skill_ready"]`. Nothing is added beyond the root arm that replaces it.

**Does `mark_skill`'s `injectedSkills` write survive?** Yes, as an `assign` on `injectedSkills` in `machines/session/definitions.ts`, unchanged, now invoked from the root arm. It survives the `parked`/`panic` reset too, because `reset_goal` does not touch `injectedSkills`. What does not survive is the literal: the arm's `params.name` was `"task-delegation"`, correct only while exactly one state activated exactly one skill. At the root it must mark the skill that reported. The callback payload carries `{ ok, exitCode?, output?, value? }` and no name, so `mark_skill` gains a payload form, `{ "from": "payload" }`, and the plugin echoes `emit.skill.name` into the callback, which it already holds when it delivers `emit.skill`. Fork F2: keep the literal and accept the single-skill assumption, or add the echo. The write itself survives either way; only its key is at stake.

## 7. What CONTRACT.md gains

> §4 gains one sentence: `towards_goal` is the goal-round compound, and `define_goal`, `work`, `check`, `validate`, `memorize`, `parked` and `panic` are its children, so the five top-level ids become `admission`, `towards_goal` and `free_work` and every goal-round path is `towards_goal.<state>`. §4 also gains one row for `states.towards_goal.on.reset_goal`, the only arm that clears a round, targeting `#session.towards_goal.define_goal` and recording `goal: ""`, `intent: "none"` and `attempts: 0`. A waiting child answers `system_user_input` by raising `reset_goal`, never by carrying the reset itself. §5 gains `emit_parent` with params `{type}`, defined as XState's `raise`: the event stays on the internal queue and is handled in the same macrostep, so one `send` still produces one `dispatch` and no port or callback is added. §5's `callback.skill_ready` row moves to the machine root, so an injection answered after its state has exited still records its result and marks its skill.

## 8. Migration

**What a parked session loses.** XState persists a compound state value as an object, so `parked` persists as `{ "towards_goal": "parked" }` after the move and as `"parked"` before. On restore, `load` in `core/machine.ts` computes `stateValuePath(stored.value)` and requires `hasStatePath` to accept it; a stored `"parked"` yields the path `parked`, which the new tree does not declare, so `isUsable` is false and `load` returns a fresh actor with `snapshot: 'shape-invalid'`. The session restarts at `admission` → `towards_goal.define_goal` with an empty context: goal, `memories`, `improvements`, `injectedSkills`, `injected`, `results` and `attempts` are all gone, and `define_goal`'s entry prompts for a goal and re-reads `preferences/user`.

The blast radius is exactly the sessions whose stored value is `"parked"` or `"panic"`. Every other path is unchanged: `admission`, `free_work`, and `{ "towards_goal": "work" | "check" | "validate" | "memorize" | "define_goal" }` all resolve to declared paths. `policy.stateId` is unaffected — `isPolicy` in `context.ts` accepts a leaf that any declared path ends with, and `define_goal` still matches `towards_goal.define_goal`. `check` stays transient under the new path because `isTransient` tests both the full path and the last segment.

The practical loss is the park summary's `improvements` list and the carried `memories`; the next user message would have reset the round anyway, so a parked session restarts into the same state it was about to reach. A restore shim that rewrites `"parked"` to `{ "towards_goal": "parked" }` would preserve them, but the shim would have to live where the machine's own state ids are known, and `core/` is machine-agnostic by contract. Fork F3.

**Test couplings to expect.** `LOOP_STATE_IDS` becomes `['admission', 'towards_goal', 'free_work']`; path-keyed assertions move from `parked`/`panic` to `towards_goal.parked`/`towards_goal.panic`. Leaf-keyed assertions — `machine.get(id).state`, the `policy.stateId` gate metadata, `stateAt` on the five working states, the `createActor(loop, 'towards_goal', ...)` start — survive unchanged, because `stateLeaf` still reports `parked`.

**Order: the hierarchy can land before the duplicated arms are removed.** Phase 1 is reparenting plus three target rewrites plus the `not_parked` guard; both children keep their own `system_user_input` arm with the six `record` items, nothing raises `reset_goal`, and the machine behaves exactly as before for a live session. Phase 2 adds the `LoopEvent` member, `emit_parent`, the parent arm and the assembly check, then deletes the six items. Phase 3 lifts `callback.skill_ready`, which touches neither of the first two.

Two constraints fix the order inside phase 1. The `not_parked` guard must change in the same diff as the reparenting, or an interruption in `parked` re-enters it and sends a second summary. And every `#session.parked` / `#session.panic` target must be rewritten in that same diff, or `assertTargets` refuses to assemble — which is the good failure, not the silent one.

## 9. Forks a user must settle

- **F1 — `emit_parent` body.** `enqueue.raise` inside `runtime.enqueueActions` (no core runtime edit, the enqueue object already carries `raise`) or `runtime.raise` as a parameterised action (two one-word core edits, one fewer indirection at the body). Recommended: the enqueue form.
- **F2 — `mark_skill`'s key after the lift.** Payload echo (`mark_skill({ from: "payload" })` plus `name` on the `skill_ready` callback, a plugin edit in `state-machine.ts`'s `emit.skill` delivery) or the literal `task-delegation` with the single-skill assumption written down. Recommended: the echo.
- **F3 — sessions parked across the upgrade.** Accept the `shape-invalid` restart, or add a state-id shim that cannot live in `core/`. Recommended: accept, because the next user message resets the round anyway and the shim would put session state ids back into core.
- **F4 — `failure` on reset.** `reset_goal` leaves `failure` set, which matches today and is invisible because `panic_escalation` renders only on the entry that just recorded a failure. Clearing it would be a behaviour change with no current symptom, so it stays.

## 10. Scope

This document settles the hierarchy, the event, the action, the two duplications and the migration. It creates no machine change: `machine.json`, `CONTRACT.md`, `definitions.ts`, `core/` and the test suite are untouched. Phase 1 is the smallest shippable slice, and it is behaviour-neutral for a live session.
