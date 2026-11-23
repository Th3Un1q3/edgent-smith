---
id: opencode/state-machine/actions
type: entities
L0: "Contract part 6: the action set — prompt, update_signals_policy, spawn_subagent, record, run_shell, run_command, activate_skill, recall_memories, record_callback, mark_skill, set_tools_policy, admit_identity, emit_parent."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
part_of: opencode/state-machine-contract
related: [opencode/state-machine/states-round, opencode/state-machine/delivery]
---

# Contract 6 — actions

Part of mem:opencode/state-machine-contract; previous mem:opencode/state-machine/states-round; next mem:opencode/state-machine/delivery.

## 5. Actions
- `prompt` — emits `emit.prompt` with its description; `text` is delivered verbatim and wins when an entry carries both forms, `template` alone renders its named template, an entry with neither fails when the action runs; params `{template,description}`, `{text,description}` or both.
- `update_signals_policy` — sets the enabled signal set for the declaring state and always emits `emit.signals` with those keys; `{set_enabled_signals}`.
- `spawn_subagent` — emits `emit.subagent`; the plugin runs a child agent under the current session and its verdict returns as `callback.<reportTo>` (default `subagent_ready`) with `{ok,output,spawnId}`; `{agent,description,template?,text?,reportTo?,timeoutMs?}`.
- `record` — assigns `set`, `increment` or capped `push` from a payload field or a literal; `op: 'fail'` records a `failure`; `{op,key,source}` or `{op:'fail',reason,detail?}`.
- `run_shell` — emits `emit.shell`; `{cmd,reportTo}`.
- `run_command` — emits `emit.command`, sent through the session command facility; a host with no facility refuses the raise by name; `{name,text?,files?,agents?,skills?,delivery?}`.
- `activate_skill` — emits `emit.skill` only when the name is absent; `{name}`.
- `recall_memories` — emits `emit.memories`; `{namespace}`.
- `record_callback` — stores `results[reportTo]`, folds `value` into `injected[key]`, records `failure` on `ok: false`; `{reportTo,key?}`.
- `mark_skill` — appends the skill name once; `{name}`.
- `set_tools_policy` — assigns `policy` when the context carries none, or clears it when `allowedTools` is null; `{stateId,allowedTools,errorMessage}` or `{allowedTools:null}`.
- `admit_identity` — records `agent` and `parentID` from an `admit` event and writes nothing on any other event; no params.
- `emit_parent` — raises `{type}` on the machine's internal queue so the parent handles it in the same macrostep; `{type}`.
- `update_signals_policy` enables each manifest signal named in `set_enabled_signals`, or maps a new name to `{description,schema}` where `schema` names the manifest signal whose codec validates it; an explicit empty `set_enabled_signals` enables no signal, while a state that sets no policy falls back to the signals its `on` arms declare.
- Action ids are `ACTION_TYPES` in `definitions.ts` and `createActions` implements each under the same key.
- `activate_skill` carries its own absence check because `entry` actions cannot be guarded.