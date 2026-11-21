---
id: cases/opencode/green-unit-suite-live-bug-present
type: cases
L0: "The unit suite was green while a live probe still showed a subagent receiving its own loop; the defect lived in live event routing that mocks never exercised, and the probe had to be repeated before it was believed."
hotness: 1.0
ttl: 180d
version: 1
freshness: 2026-11-20
directory: cases/opencode
status: active
provenance: "retrospective reported by the orchestrator of the 2026-11 state-machine run; incident details recorded as reported, source tree not re-read in this session (UNVERIFIED as to file paths)"
related: mem:cases/opencode/state-machine-snapshot-read-during-init, mem:cases/orchestration/child-evidence-before-verdict
claim_ids: []
---
# A green unit suite over a live bug
## Symptom
The unit suite passed while the live machine still handed a subagent its own loop: the child received a loop event that belonged to its parent. Nothing in the test output hinted at it; only a real session showed the wrong recipient.
## False hypothesis
That green units mean the behaviour is right, so the live discrepancy was environmental noise, and the first odd probe result was a one-off that did not need reproducing.
## Root cause
The units asserted per-unit outputs against stubbed actors, so they never exercised the composed wiring where a loop event is routed to a child. The defect was in the routing of the composed system, a fact no unit-level assertion was positioned to see.
## How confirmed
Only a probe session showed the subagent receiving its own loop, and only after the probe was repeated: the first probe result was not trusted and not reproduced, so it was nearly dismissed. The repeat made the misrouting reproducible and separated it from noise.
## Prevention
For a wiring or routing change, a live probe is part of done, and the report names which behaviour the unit suite does and does not cover. Repeat a surprising probe once before believing or dismissing it; an unrepeated probe is not evidence either way. Source: reported retrospective, 2026-11 state-machine run (UNVERIFIED paths).