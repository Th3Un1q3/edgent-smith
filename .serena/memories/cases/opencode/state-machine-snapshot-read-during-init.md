---
id: cases/opencode/state-machine-snapshot-read-during-init
type: cases
L0: "Reading self.getSnapshot().value inside the action threw 'Snapshot can't be read while the actor initializes itself' and failed 66 tests. Carry the state id in action params, as set_tools_policy does, and assert it matches its containing state."
hotness: 1.0
ttl: 180d
version: 1
freshness: 2026-11-19
directory: cases
status: active
provenance: "retrospective reported by the orchestrator of the 2026-11 state-machine run (display_signals -> update_signals_policy); confirmed by the xstate error on every machine start and 66 failing tests; plugin tree re-read 2026-11-19"
claim_ids: []
---
# The action read its snapshot while the actor was still initializing

## Symptom
The first `update_signals_policy` implementation, replacing `display_signals`, learned the current state by calling `self.getSnapshot().value` inside the action. xstate threw "Snapshot can't be read while the actor initializes itself" on every machine start and 66 tests failed.

## False hypothesis
That an action may read the actor snapshot whenever it runs, so fetching the state id inside the action was harmless bookkeeping, and the failure looked like a test-harness timing flake rather than an illegal read.

## Root cause
xstate initializes actors before their snapshot is readable, so an action that runs in that window cannot query the actor. The state id is already known where the state is defined; reading it at runtime bought nothing and depended on a moment the action does not control.

## How confirmed
The xstate error text appeared on every machine start, with 66 failing tests. The pre-existing `set_tools_policy` action takes `{ stateId, allowedTools, errorMessage }` as action params instead of reading the snapshot (mem:cases/composition-contract-entry-path-unopened documents the same file), so the working pattern was already in the tree.

## Prevention
Pass the state id through the action params and never call `getSnapshot` inside an action body. Add a load-time assertion that the param equals the id of the state that contains the action, so copying the action into another state fails at load instead of at start. Related: mem:cases/opencode/signals-tool-signals-closed-over covers the second slice this run needed.