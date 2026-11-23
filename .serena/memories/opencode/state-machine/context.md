---
id: opencode/state-machine/context
type: entities
L0: "Contract part 3: the LoopContext fields — who writes, clears and reads each — and the six guards that gate transitions on that context."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
part_of: opencode/state-machine-contract
related: [opencode/state-machine/states-structure]
---

# Contract 3 — context and guards

Part of mem:opencode/state-machine-contract; previous mem:opencode/state-machine/events; next mem:opencode/state-machine/states-structure.

## 3. Context
- `context.ts` declares `LoopContext`, the fresh and restored defaults and the snapshot field list; core treats the context as an opaque record and reads no field by name.
- `goal` — written by the `SET_GOAL` record, cleared by `reset_goal`; read by work, park and panic prompts.
- `intent` — written by validate, memorize and panic arms, `none` by `reset_goal`; read by the memorize prompt and the improvement guard.
- `attempts` — `GOAL_INCOMPLETE` under the limit, 0 by a panic lesson and `reset_goal`; read by `counter_below` in validate.
- `memories` — lessons from work, memorize and panic; read by the work prompt.
- `improvements` — the improvement lesson; read by the park summary.
- `injectedSkills` — `mark_skill` on the root `callback.skill_ready` arm; read by `activate_skill`.
- `injected` — `record_callback` when the payload carries `value`, once per memory key; read by the work prompt (`preferences/user`).
- `memoryTokens` — the same `record_callback`; the same action drops a repeated key.
- `results` — every `record_callback`; read by `callback_ok` and diagnostics.
- `policy` — `set_tools_policy` on `define_goal` entry and with `allowedTools: null` on its exit; restored from the snapshot; read by the tool gate.
- `failure` — `record` with `op: 'fail'` or a failed callback; read by the panic prompt.
- `maxAttempts`, `memoryLimit` — initializer; read by the attempt guard and the `push` cap.

## 6. Guards
- `field_present` — the named payload field is a nonblank string; `{field: 'goal' | 'text'}`.
- `counter_below` — a context counter is under a limit, which may be another context field; `{key: 'attempts', limit}`.
- `improvement_lesson` — the intent is `improvement`; the `LESSON` schema has already refused blank text; no params.
- `callback_ok` — the callback event reports success; no params.
- `not_parked` — the machine is not in `parked`; no params.
- `session_agent` — the session's agent is in `params.in` and it has no parent; `{in: [...]}`.