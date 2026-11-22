---
id: cases/serena-memory/pre-named-targets-wrong-namespace
type: cases
scope: serena-memory
status: active
confidence: 0.9
date: 2026-11-21
freshness: 2026-11-21
hotness: 0.6
ttl: 180d
version: 2
supersedes: cases/orchestration/tmp-path-named-as-deliverable
provenance: "Memory child report and the two dispatch prompts, 2026-11-21 retrospective"
L0: "The dispatch author pre-named research/ and design/ targets that do not exist (the convention is researches/), so the memory child remapped names mid-task; a .tmp/ path is no target either, because AGENTS.md:212 outranks task-delegation:108,142."
---

# Pre-named memory targets that do not resolve

## Symptom
The dispatch author pre-named `research/...` and `design/...` as the memory targets. The store's convention is `researches/`. The memory child discovered the mismatch and remapped the names mid-task. The same dispatch author named `/workspace/.tmp/aidlc-concepts.md` and `/workspace/.tmp/deep-research-aidlc-design.md` in a DELIVERABLE clause of two prompts, so scratch became the home and durable findings reached memory only at promotion.

## False hypothesis
A name that describes the deliverable well enough will resolve to the right place in the store, so the dispatch author need not check it before dispatch. A `.tmp/` path rests on the same assumption: it names a place, not a target the store or the repository will hold.

## Root cause
The dispatch author authored the target names from the deliverable titles instead of reading the store's index. task-delegation:137 requires pre-naming the target memory and capping discovery, but does not require confirming that the name resolves, so the check landed inside the child's budget instead of the dispatch author's. Where two rule families disagree about a destination, the dispatch author applied no precedence: task-delegation:108 lists a `.tmp/` path as a landing target and task-delegation:142 says to name it in the prompt, while AGENTS.md:212 calls a `.tmp/` path in a hand-off, commit, or deliverable a defect and AGENTS.md:214 gives an explicit repository convention precedence. Unranked, the forbidden home looked sanctioned.

## How confirmed
The memory child reported the pre-named targets absent and the remap; `researches/about` is the live index in the store. Both dispatch prompts quote the `.tmp/` paths, and the drafts predated the memory writes, so neither research child's report carried a mem: reference.
Source: memory child report and the two dispatch prompts, 2026-11-21 retrospective.

## Prevention
- The dispatch author resolves each memory target against the store's index before dispatch; a name that does not resolve is dispatched as a discovery question, not as a target.
- The dispatch author names a memory name or a repository path as a deliverable target. `.tmp/` carries intermediates only and is never written as a deliverable; where a task-delegation line lists `.tmp/` and AGENTS.md:212 forbids it, AGENTS.md governs.
- Where a large row set must ship as a file (task-delegation:142), the dispatch author sends the file to a repository path and the durable rows to memory.
- The reviewer checks each dispatch prompt's named targets against the store index before the child starts, so a name that does not resolve costs the dispatch author a correction, not the child's budget.

Related: mem:cases/shell-denied-in-subtask, mem:cases/orchestration/reading-children-without-capture-pack
