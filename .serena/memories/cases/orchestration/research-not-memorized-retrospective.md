---
id: cases/orchestration/research-not-memorized-retrospective
type: cases
status: active
date: 2026-10-24
scope: orchestration
L0: "Research was not persisted: storage target unplanned, memory write burned budget on discovery, web research returned a task contract, taxonomy truncated at word cap, skill scout transcript truncated."
---

# Research Not Memorized — Retrospective

Root causes: storage target was never planned as a memory deliverable; the memory-writing child burned its budget on discovery because the target name was not pre-stated; web research returned a task contract instead of the deliverable; the taxonomy report truncated at the word cap because mandatory blocks were not counted; the skill scout transcript truncated and its task id was not captured.

Fixes: state the storage target before dispatch; pre-name the target memory and cap discovery reads; treat a returned task contract or plan as not-done; state path shape and installer versions before research; make word caps state whether mandatory blocks count and give the item count.

Related: mem:architecture/adr/ADR-016-skill-directory-grouping
---