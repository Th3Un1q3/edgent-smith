---
id: cases/opencode/guard-proliferation-to-one-policy-guard
type: cases
L0: "Two admission guards (loop_agent, agent_known) plus a stateId assertion collapsed to one guard with params {in:[...]} and an unguarded fallback; the stateId assertion existed only to feed per-state arm derivation."
hotness: 1.0
ttl: 180d
version: 1
freshness: 2026-11-20
directory: cases/opencode
status: active
provenance: "retrospective reported by the orchestrator of the 2026-11 state-machine run; incident details recorded as reported, source tree not re-read in this session (UNVERIFIED as to file paths)"
related: mem:cases/criterion-universal-unmeasured, mem:cases/opencode/state-machine-snapshot-read-during-init
claim_ids: []
---
# Three admission guards collapsed to one parameterized guard and a fallback
## Symptom
Admission control on the state machine grew two guards, loop_agent and agent_known, wired arm by arm, plus a stateId assertion whose job was to bind each guard to the state that used it. Every new admission rule meant another guard, another arm, and another assertion, and the shape was hard to reason about because the rules were spread across arms.
## False hypothesis
That each admission rule is a different kind of fact, so it needs its own guard, and that a guard must be told its state id because it lives on a per-state arm table. Both were artifacts of how the guards had been derived, not properties of the rules.
## Root cause
The guards encoded predicates one rule at a time instead of one predicate over a parameter, and the stateId assertion existed only because the per-state arm tables carried the state id as a parameter. With one explicit policy slot owning admission, the guard receives its allow-list as params and the state needs no id at all.
## How confirmed
The collapse produced one guard with params { in: [...] } and an unguarded fallback arm; the admission scenarios that the two guards had covered still passed, and the whole policy became readable in one line. The stateId assertion was deleted with nothing left needing it.
## Prevention
Start with one parameterized guard plus an unguarded fallback. Add a guard only when the predicate cannot be carried as a value, and never add a stateId assertion to bind a guard to its state: supply the value through the single policy slot instead. Source: reported retrospective, 2026-11 state-machine run (UNVERIFIED paths).