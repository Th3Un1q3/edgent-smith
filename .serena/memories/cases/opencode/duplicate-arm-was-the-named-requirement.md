---
id: cases/opencode/duplicate-arm-was-the-named-requirement
type: cases
L0: "An always pair identical in effect to an on.admit pair was deleted as a duplicate, then restored because the requirement named always; removing it changed the named mechanism, not just the representation."
hotness: 1.0
ttl: 180d
version: 1
freshness: 2026-11-20
directory: cases/opencode
status: active
provenance: "retrospective reported by the orchestrator of the 2026-11 state-machine run; incident details recorded as reported, source tree not re-read in this session (UNVERIFIED as to file paths)"
related: mem:cases/orchestration/prose-reachability-unreachable-self-arm
claim_ids: []
---
# A "duplicate" arm that the requirement named
## Symptom
A state carried an always pair and an on.admit pair that reached the same target with the same actions. The always pair was deleted as redundant, and it had to be restored because the requirement explicitly named always as the mechanism.
## False hypothesis
That two arms with the same target and the same actions are redundant, so removing one is a cleanup with no behavioural consequence.
## Root cause
Duplicate in effect is not duplicate in contract. always re-evaluates unconditionally, while on.admit fires only when that event arrives; and the requirement named always, so its presence was part of the deliverable. Deleting it removed the named mechanism, not merely a second spelling of the same one.
## How confirmed
The requirement text named always. Restoring the arm made the named mechanism present again, and the admit-less path behaved as required; the on.admit pair alone did not cover it.
## Prevention
Before deleting an apparently redundant arm, check whether a requirement names that arm type. If two arms genuinely duplicate, change the requirement or the table deliberately and record which arm survives; never silently drop the arm the requirement names. Source: reported retrospective, 2026-11 state-machine run (UNVERIFIED paths).