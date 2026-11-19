---
id: cases/serena-memory/untyped-orchestrator-supplied-id
type: cases
L0: "Orchestrator pinned a memory id outside the nine typed scopes; content landed and read back fine, gate failed 8/9 at Typed. A dispatch saying use-exactly-this yields to the skill naming gate."
hotness: 0.75
ttl: 180d
freshness: 2026-11-12
directory: cases/serena-memory
---

# Case: orchestrator-supplied memory id outside the typed scopes

scope: cases — single failure + fix, not a claim (no atomic fact to cite) and not a trajectory (one incident)

## Symptom

A dispatch carried: TARGET MEMORY NAME (use exactly this; do not invent a namespace): `research/parloa-staff-swe-hiring-manager`. The child wrote it; the content landed and read back correctly; the skill's 9-check gate returned 8/9 — Typed failed, because `research/` is neither one of the nine typed scopes (`profile/ preferences/ entities/ events/ cases/ trajectories/ experiences/ claims/ cache/`) nor the exempt `researches/` prefix. The finding sat at the non-conforming id.

## False hypothesis

Content landed and reads back, so the write is sound and the gate is advisory. It is not: the gate blocks, and a correct body at an untyped id is still a failing memory.

## Root cause

The orchestrator authored the id from the subject matter (research is the topic, not a type) instead of from the skill's typed-scope enum, then paired it with a hard constraint. The child treated `use exactly this` as outranking the skill's naming gate, so two authorities collided and it escalated the contradiction instead of resolving it. The naming rule lost to a dispatch phrase, and the fix cost a second dispatch.

## How confirmed

Second dispatch stating that the skill's typed-scope rule wins: content moved to `researches/parloa-staff-swe-hiring-manager` (exempt prefix — singular vs plural is the whole bug), gate reached 9/9, misplaced copy deleted.

## Prevention

- An orchestrator-supplied memory id MUST be one of the nine typed prefixes or an exempt prefix (`researches/ cache/ serena/ private/ browser-automation/ evals/`). Write the prefix from that list; never derive it from the subject, and check the plural.
- `use exactly this` never overrides the skill's naming gate. On conflict, keep the content, relocate to the nearest conforming prefix, and report the correction — escalating a naming contradiction is a lost round.
- A child that finishes a write without running the Typed check ships a non-conforming finding even when read-back passes.
- Assigning the write, verify the id against the enum before dispatch: the orchestrator owns the id, so the orchestrator owns this failure.

provenance: this session's memory-write dispatch pair (typed-gate failure at research/, then move to researches/)