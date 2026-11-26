---
id: cases/opencode/stale-guidance-surface-after-plugin-contract-change
type: cases
L0: "A plugin tool's contract also lives in the session machine's agent-facing templates and its description string; a grep of the plugin sources left guidance on the removed `<task_skills>` block standing."
hotness: 1.0
ttl: 365d
version: 1
freshness: 2026-11-26
directory: cases/opencode
status: active
provenance: subtask_run skill-injection rework, 2026-11-26
related: mem:cases/opencode/doc-rename-dropped-tool-contract
---
# Stale guidance after a plugin tool's contract change

## Symptom
`subtask_run`'s skill-injection mechanism was replaced with a native one. The independent validator's grep of `.opencode/plugins` for the removed mechanism returned zero hits, yet agent-facing guidance still told readers that the tool built a `<task_skills>` text block and skipped a skill name that resolved to no file.

## False hypothesis
The plugin sources are the only place a plugin tool's contract is described, so grepping them is a complete doc sweep.

## Root cause
`subtask_run`'s behaviour is also written on surfaces outside the workflow sources: the session machine's agent-facing templates, `.opencode/plugins/state-machine/machines/session/templates/work_towards_goal.md` and `plan_stage.md`, and the tool's own description string. The implementer who ran the rework swept the workflow sources, where the mechanism was removed, and left every template that still described the old behaviour untouched.

## How confirmed
The independent validator's criterion "no `task_skills` remains under `.opencode/plugins`" hit `work_towards_goal.md:79`. The implementer then corrected both templates and re-swept the whole `.opencode` tree.

## Prevention
When a plugin tool's contract changes, the implementer sweeps the whole `.opencode` tree for the removed mechanism's name and for the behaviour phrase, and updates every agent-facing template and instruction, not only the plugin sources. The dispatch author puts those template paths in the doc-sweep file list up front.
