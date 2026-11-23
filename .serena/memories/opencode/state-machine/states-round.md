---
id: opencode/state-machine/states-round
type: entities
L0: "Contract part 5: the goal round — entry actions and arms for define_goal, work, check, validate, memorize, retrospective, parked and panic."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
part_of: opencode/state-machine-contract
related: [opencode/state-machine/states-structure, opencode/state-machine/actions]
---

# Contract 5 — the goal round

Part of mem:opencode/state-machine-contract; previous mem:opencode/state-machine/states-structure; next mem:opencode/state-machine/actions.

## 4. States and transitions — the round
- `towards_goal`: `system_idle` [`counter_below` `nudges` 3] → self (increment `nudges`, prompt `idle_nudge`), otherwise → `panic` (record the failure, prompt `panic_escalation`).
- `free_work`: `system_interrupted` → self, no action.
- `define_goal` entry: prompt `goal_request`, `update_signals_policy`, request `preferences/user` memories, install the tool policy; `SET_GOAL` → `work` (records `payload.goal`); `callback.memories_ready` → self (records value).
- `work` entry: prompt `work_towards_goal`, `update_signals_policy`, request `task-delegation` when absent; `CLAIM_WORK` → `check`; `callback.memories_ready` → self.
- `check` entry: run `just opencode::typecheck`; `callback.quality_check_ready` [`callback_ok`] → `validate`, otherwise → `panic` with the failure.
- `check` is transient: it exists only between `CLAIM_WORK` and the shell callback.
- `validate` entry: prompt `validation_self_report`; spawn a `judge` subagent (`reportTo` `subagent_ready`, 120 s) as the primary verdict, the prompt as the fallback for a host with no subagent facility.
- `validate`: `GOAL_ACHIEVED` → `memorize` (intent improvement); `GOAL_INCOMPLETE` [`counter_below`] → `memorize` (attempt + 1, intent lesson), otherwise → `panic` (attempts exhausted); `callback.subagent_ready` [`callback_ok`] → `memorize`; a `fail` verdict records it → `panic`; no verdict (port unavailable or timed out) records it and stays in `validate`.
- `memorize` entry: prompt by intent, `update_signals_policy`; `LESSON` [improvement] → `retrospective` (push improvement); `LESSON` [text present] → `retrospective` (push lesson).
- `retrospective` entry: `run_command` the `retrospective` command, `update_signals_policy`; `RETROSPECTIVE_COMPLETE` [improvement] → `parked`; `RETROSPECTIVE_COMPLETE` → `work`.
- `parked` entry: prompt `park_summary`; `system_user_input` → raise `reset_goal`.
- `panic` entry: prompt with the failure, `update_signals_policy`; `LESSON` [text present] → `work` (push lesson, reset attempts); `system_user_input` → raise `reset_goal`.