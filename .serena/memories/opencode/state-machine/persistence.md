---
id: opencode/state-machine/persistence
type: entities
L0: "Contract part 8: snapshot persistence (codec, record shape, read outcomes, restore rules) and the tool-policy gate in core/policy.ts."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
part_of: opencode/state-machine-contract
related: [opencode/state-machine/delivery, opencode/state-machine/host-effects]
---

# Contract 8 — snapshot persistence and policy gate

Part of mem:opencode/state-machine-contract; previous mem:opencode/state-machine/delivery; next mem:opencode/state-machine/host-effects.

## 8. Snapshot persistence
- `core/snapshot.ts` persists one JSON value per session under `state-machine/<sessionId>`; the session's `context.ts` owns what that value may contain; `snapshotCodec` (exported as `DEFAULT_SNAPSHOT`) supplies the allowlisted field set and the text limit, and the store binds and reads through it without naming a field.
- `createSnapshotRecord` writes the allowlisted field set plus `storedAt` and `expiresAt` (30 days); memories are idempotency keys `mem:<path>:complete`, `mem:<path>:ref`, `skill:<name>:complete`; results are stored whole; only the goal text is capped; any other context key is dropped.
- `parseSnapshotRecord` validates the known shape, ignores unknown fields, and returns `'expired'` or `'shape-invalid'` when the record is unusable.
- `SnapshotStore.read` returns `present`, `absent` (`missing` | `expired` | `shape-invalid`) or `rejected`; `write` resolves `false` when the store rejects it and never fails the caller.
- `StateMachine.ensure(sessionId,agent)` reads the snapshot on a session's first access and shares one read between concurrent callers.
- `present` → actor restored from the stored state and context, `policy` included; entry actions run again and only their emits are dropped.
- `present` in `check` is treated as absent: `check` is transient, and restoring into it would wait for a callback that no longer exists.
- `absent` (missing, expired or malformed) → actor created at the agent's configured start state with a fresh context.
- `rejected` → no actor; the session's gate allows until a later signal starts it.
- `StateMachine.persist(sessionId)` returns `written`, `skipped` (no machine or no store) or `write-failed`; the plugin calls it after a signal, a callback and an idle event, and logs `write-failed` without the payload; a rejected write keeps the previous record.

## 9. Tool policy gate
- `define_goal`'s entry `set_tools_policy` allows `signal_send`, `execute`, `question` and `skill`; its exit `set_tools_policy` with `allowedTools: null` removes the rule.
- The rule lives in the machine context as `policy`, so a transition keeps it in step and the snapshot carries it; every other state declares no rule, so every tool passes there.
- `set_tools_policy` writes the declaration only when the context carries no policy yet, so a restored snapshot's own `policy` wins over it.
- `core/policy.ts` owns only the decision: `decide({agent,isChild,state,policy,tool})` allows when the agent is not `rug`, the session has a parent, no rule is active, or the tool is listed; otherwise it returns the rule's message with `<name>` and `<state>` substituted.
- The plugin registers `execute.before`, logs `{ tool, input keys }` and never the payload, returns early for another agent or a child session, opens the session's machine, then decides from that machine's state and policy.
- A block fails the hook with `Tool.Error` carrying the message and `metadata = { code: 'tool_blocked', tool, state, allowed_tools }`, so the call never runs.
- `parentID` is read once per session through `context.session.get` and cached; opening awaits the memoised restore, so the first call after a reload is gated by the restored policy.