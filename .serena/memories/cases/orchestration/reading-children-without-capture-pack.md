---
id: cases/orchestration/reading-children-without-capture-pack
type: cases
scope: orchestration
status: active
confidence: 0.9
date: 2026-11-21
freshness: 2026-11-21
hotness: 0.7
ttl: 180d
provenance: "Orchestrator observations plus child interviews, 2026-11-21 retrospective"
L0: "context-gathering was attached to the one inventory child that failed and not to the three children that read 40+ repo files, so no source was cached and no report carried a mem: reference."
---

# Reading children dispatched without the capture pack

## Symptom
Three research children read roughly 40 repository files through the GitHub gateway. The dispatch author attached no capture pack to them and asked for no mem: reference, so no child cached a source and no child returned one.

## False hypothesis
The dispatch author reasoned that the research children only synthesize, so the capture pack belongs to the later memory stage; and read "Return the deliverable, never the process" (task-delegation:42) as forbidding per-source notes.

## Root cause
The dispatch author attached the pack by stage name from the scouting pass, not by what the child would read. The scouting pass named context-gathering for research; the dispatch author attached it only to the inventory child that died on the shell denial, and named serena-memory for the promotion stage only. context-gathering:82 makes persistence a completion condition ("a report carrying no mem: reference is incomplete") and context-gathering:89 requires "on miss store raw response with mem: refs"; both rules live in a pack the reading children never loaded, and task-delegation:136 tells the dispatcher to "name the one skill that owns them" without requiring it for capture.

## How confirmed
The attachment list per child shows the capture pack on the failed inventory child only. Four child reports contain zero mem: refs. The dispatch author scheduled the memory stage after all reading had finished, so the promotion child rebuilt every source from report text instead of from a cache taken at read time.

## Prevention
The dispatch author attaches the capture pack to every child that reads external or repository sources, and writes one mem: reference per source read into that child's return contract. The child treats memory as the capture instrument during reading, not as a post-processing stage. The dispatch author does not re-dispatch a source already read to compensate for an uncached read.

Related: mem:cases/research-artifact-last-uncapped-fetch, mem:cases/orchestration/research-not-memorized-retrospective
