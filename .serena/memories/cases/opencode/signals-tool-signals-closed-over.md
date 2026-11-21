---
id: cases/opencode/signals-tool-signals-closed-over
type: cases
L0: "The slice owning definitions.ts and machine.ts left signals.ts closing over TOOL_SIGNALS, so the user's ad-hoc signal was stored but neither accepted nor advertised. Trace a datum to every definition site, constants modules included, before slicing."
hotness: 1.0
ttl: 180d
version: 1
freshness: 2026-11-19
directory: cases
status: active
provenance: "retrospective reported by the orchestrator of the 2026-11 state-machine run; confirmed by the stored-but-not-accepted user entry and the implementer's residual-risk note; tree re-read 2026-11-19 (TOOL_SIGNALS defined in core/signals.ts)"
claim_ids: []
---
# signals.ts stayed closed over TOOL_SIGNALS while the action changed elsewhere

## Symptom
The slice that owned `definitions.ts` and `machine.ts` replaced `display_signals` with `update_signals_policy`, but `signals.ts` still closed the accepted set over `TOOL_SIGNALS`. The user's own ad-hoc entry `{ UPDATE_GOAL: { schema: "SET_GOAL" } }` was stored but neither accepted nor advertised. Only the implementer's residual-risk note surfaced it, and a second slice was needed.

## False hypothesis
That the change surface was `definitions.ts` plus `machine.ts`, because that is where the action type, the state wiring and the tool policy live; `signals.ts` read as a constants module whose content the new policy would just consume.

## Root cause
The accepted signal set is produced in `signals.ts`, where `TOOL_SIGNALS` filters what is declared and rendered; `machine.ts` only re-exports it. A slice scoped by "the files that define the action" cannot see a second definition site in a sibling module, so the closure kept the old set authoritative after the action changed, and storage still succeeded because the entry was persisted before acceptance.

## How confirmed
The user entry was persisted in the machine state yet neither accepted at validation nor advertised in the rendered signal list, and the residual-risk note named `signals.ts`. The tree shows `TOOL_SIGNALS` defined in `core/signals.ts` (line 9) and used to filter declared signals and the refusal message, while `core/machine.ts` only re-exports it.

## Prevention
Before slicing, name the datum (the accepted signal set) and trace it to every definition site — constants modules, closures, re-exports — rather than to the files that define the action. Sweep the plugin directory for both the new and old names, and either include the set-defining module in the slice or assert that the accepted set derives from the policy. Related: mem:cases/opencode/state-machine-snapshot-read-during-init.