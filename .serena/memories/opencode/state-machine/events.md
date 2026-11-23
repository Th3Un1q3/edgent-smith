---
id: opencode/state-machine/events
type: entities
L0: "Contract part 2: the event vocabulary — agent_sent_signal.* tool signals, action-raised emit.*, plugin-raised callback.*, host system_* — and the prompt-template rules."
freshness: 2026-11-23
provenance: .opencode/plugins/state-machine/CONTRACT.md, removed from the tree on 2026-11-23
part_of: opencode/state-machine-contract
related: [opencode/state-machine/context]
---

# Contract 2 — event vocabulary and templates

Part of mem:opencode/state-machine-contract; previous mem:opencode/state-machine/layout-effects; next mem:opencode/state-machine/context.

## 2. Event vocabulary
- `agent_sent_signal.*` is the only tool-reachable family: `SET_GOAL`, `CLAIM_WORK`, `GOAL_ACHIEVED`, `GOAL_INCOMPLETE`, `LESSON`, `RETROSPECTIVE_COMPLETE`.
- Each such event carries `{ type, payload? }`; `SET_GOAL` uses `payload.goal`, `LESSON` uses `payload.text`; payloadless signals carry no payload and drop any they receive.
- `emit.*` is raised by actions, never by the model: `prompt{text,description}`, `subagent{agent,text,description,reportTo,timeoutMs}`, `shell{cmd,reportTo}`, `skill{name,reportTo}`, `memories{namespace,reportTo}`, `signals{signal_keys?}`.
- `emit.dispatch` is retired and answered with a failed `subagent_ready` naming `emit.subagent`.
- `callback.*` is sent by the plugin after its async work with `{ok,exitCode?,output?,value?}`: `callback.quality_check_ready`, `callback.skill_ready`, `callback.memories_ready` and `callback.subagent_ready` are `CALLBACK_NAMES` in `context.ts`; `spawn_subagent` defaults `reportTo` to `SUBAGENT_READY`.
- Host events: `system_idle`, `system_user_input`, `system_interrupted{reason}` where `reason` is `user`, `shutdown`, `superseded` or `inactivity`.
- `signal_send` maps its `type` to `agent_sent_signal.<TYPE>` and validates `payload` against that signal's declaration in the current state.
- `emit.*`, `callback.*` and `system_*` are not reachable from the tool.

## 5a. Prompt templates
- `machines/session/templates/` holds one markdown file per template id; `TEMPLATE_IDS` in `template-files.ts` is the authority for the names.
- A file is the only copy of its wording; the loader reads the directory once at load; a file with no id or an id with no file fails assembly.
- Unknown placeholder throws when the template renders; a value `undefined` renders empty; a repeated placeholder substitutes at every occurrence.
- `{{#name}}` / `{{^name}}` render the body when the value is defined or not defined; sections do not nest.