---
id: cases/guessed-plugin-path
type: cases
L0: "An implementer brief named .opencode/plugins/core/machine.ts, which does not exist; the module is plugins/state-machine/core/machine.ts. Open every allowlist path before dispatch and copy it from the discovery report."
hotness: 0.6
ttl: 180d
version: 1
freshness: 2026-11-16
directory: cases
status: active
provenance: "RUG orchestration run 2026-11-16; children ses_e1a18bb68ffeFNKxVJOPuDSgkb, ses_e1a18bb69ffeQgIkFmLzQ9uoUe; directory reads same run"
---
scope: cases — single failure plus fix; one brief, one wrong path.

## Symptom
The implementer prompt's write allowlist named `.opencode/plugins/core/machine.ts`. The tree holds `.opencode/plugins/state-machine/core/machine.ts`. The validator then asked which path the brief meant, spending a question on a path the orchestrator had invented.

## False hypothesis
The path was right and the module had been moved during the run, so the brief lagged the tree.

## Root cause
The allowlist was written from the orchestrator's model of the tree instead of from the discovery report it had just received. `task-delegation/SKILL.md:117` existence-checks edit anchors; `:116` names the write allowlist but checks nothing inside it, so a path nobody opened reaches the child.

## How confirmed
`read .opencode/plugins/core` returned File not found. `read .opencode/plugins/state-machine/core` listed `machine.ts` beside `inbox.ts`, `memory.ts`, `policy.ts`, `snapshot.ts`. Both reads ran in this run.
Source: orchestrator observation and child ses_e1a18bb69ffeQgIkFmLzQ9uoUe.

## Prevention
Open every path in the write allowlist before dispatch and copy it from the discovery report; replace a path that fails to open in the same round. A brief that retypes a path from the orchestrator's memory is guessing.
Related: `mem:cases/orchestration/delegation-prompt-assumptions` covers assumptions about where artifacts live; this case is the narrower one where an allowlist path was never opened.