---
id: skills/general/skill-exploration-zero-to-three
type: experiences
L0: "Skill exploration recommends zero to three skills per stage, never exactly one. Stages combine complementary capabilities (implementation plus test discipline); near-duplicates never stack. Payload is an array per stage, passed to the subtask unchanged."
hotness: 0.8
ttl: 180d
version: 1
freshness: 2026-10-22
directory: skills/general
provenance: .opencode/agents/rug.md section Skill exploration; just verify-agents and just ci-fast (13/13 gates) on 2026-10-22
---

# Skill Exploration: Zero to Three Skills per Stage

## Idea
The skill-exploration stage recommends 0-3 skills for each stage, never exactly one candidate. Zero is valid when no skill fits, and three is the ceiling. Recommendations combine complementary capabilities, such as implementation plus its test discipline, and never stack near-duplicates. The payload is an array of skills per stage with maxItems 3 and an empty array allowed, and the consumer passes that array to the subtask unchanged.

## Scope
Applies to the skill-exploration pattern in the RUG orchestrator and to every consumer that converts a scout recommendation into subtask skills. It governs the recommendation shape and the pass-through. It does not govern which skills exist, which stage a skill belongs to, or any other scouting question.

## Rationale
A stage is a unit of work, not a unit of capability. Implementation and its test discipline are complementary, and a single-skill slot forces the scout to drop one of them or to promote a near-duplicate into the slot, which re-injects overlapping instructions into one child. An array keeps the selection with the scout, the maxItems 3 ceiling blocks duplicate stacking, and unchanged pass-through stops the orchestrator from filtering or re-interpreting a recommendation it did not make.

## Evidence
The .opencode/agents/rug.md section Skill exploration, edited 2026-10-22: one prose line states that skills per stage are 0-3 and never more, that zero is valid when no skill fits, and that three is the ceiling. The recommendation schema declares each stage skills field as an array of strings with maxItems 3, required together with stage and reason. The example consumer resolves skillsFor(stage) and passes the array straight into the next run with no filtering. The edit passed just verify-agents (8 AGENTS.md grep gates plus the threshold pin) and just ci-fast, 13 of 13 gates.

Source: .opencode/agents/rug.md Skill exploration section as edited on 2026-10-22; gate output from just verify-agents and just ci-fast in that run.