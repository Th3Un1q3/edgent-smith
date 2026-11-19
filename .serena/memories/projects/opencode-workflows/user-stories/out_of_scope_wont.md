---
id: projects/opencode-workflows/user-stories/out_of_scope_wont
L0: "Won't this iteration: gate signal prose removal, dynamic tool schema, phases or substates, AJV, extra-key tolerance, dispatch availability"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: design session 2026-11-17; SIGNALS-CONTRACT.md decisions
---
# Won't this iteration

Each item was considered and rejected for the current slices. Revisit only with the stated trigger.

- Gate signal prose removal. The define_goal message keeps "Call signal_send with SET_GOAL". Accepted because that state declares exactly one signal; the gate constrains tools, and the availability line reaches the agent through the prompt and refusals. Revisit when define_goal gains a second signal.
- Dynamic per-state tool input schema. The model would see the exact payload fields for the active signal, but the tool surface would change on every transition, require editor.update on the hot path, and go stale mid-turn. Revisit only if prompts and refusals prove insufficient in a live run.
- Phase field, available_when predicate, XState substates. Static availability plus a state split covers flips without touching LoopStateId, the snapshot state field, or transient-state restore. Revisit when a flip needs to preserve one state's identity.
- AJV or a hand-rolled validator. Effect Schema is already loaded and can ingest JSON Schema for the YAML stage. Revisit only if Effect Schema cannot express a required constraint.
- Tolerating extra keys on schema'd signals. Strict decoding (onExcessProperty error) prevents an action from reading an undeclared key. Revisit only for a third-party payload that cannot be narrowed.
- Deriving TOOL_SIGNALS now. Literal typing of LoopEventType and transition keys depends on it. Revisit with US-10.
- Appending the availability line to validate's dispatch. That text addresses a validator child, and a child's signals do not reach the parent machine. Revisit when validator routing is designed.
- Validating callback and system events. They arrive from typed constructors inside the plugin, not from the model. Revisit only if a host callback becomes model-influenced.