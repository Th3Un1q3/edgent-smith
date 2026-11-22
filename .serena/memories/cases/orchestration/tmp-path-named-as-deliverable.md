---
id: cases/orchestration/tmp-path-named-as-deliverable
type: cases
scope: orchestration
status: superseded
superseded-by: cases/serena-memory/pre-named-targets-wrong-namespace
confidence: 0.9
date: 2026-11-21
freshness: 2026-11-21
hotness: 0.1
ttl: 180d
provenance: "Dispatch author's observations plus child interviews, 2026-11-21 retrospective"
L0: "SUPERSEDED by cases/serena-memory/pre-named-targets-wrong-namespace - /workspace/.tmp/*.md named as deliverables; kept for audit only."
---

> **Superseded by mem:cases/serena-memory/pre-named-targets-wrong-namespace.** That case carries the lesson, including the AGENTS.md:212 precedence over task-delegation:108,142. This body is kept for audit only; do not follow it as guidance.

# A .tmp/ path named as the deliverable

## Symptom
The dispatch author wrote `/workspace/.tmp/aidlc-concepts.md` and `/workspace/.tmp/deep-research-aidlc-design.md` into the DELIVERABLE clause of two dispatch prompts. The research children wrote there. Durable findings reached memory only at promotion, after all reading.

## False hypothesis
The dispatch author held that naming any target satisfies "name where each deliverable lands" (task-delegation:108), and that the memory child would apply the persistence pack later, when it promoted the draft.

## Root cause
Neither rule family ranked the other. task-delegation:108 lists "repository path, memory name, or `.tmp/` path" as landing targets, and task-delegation:142 says "Name the `.tmp/` path in the prompt". AGENTS.md:212 says "A .tmp/ path in a hand-off, commit, or deliverable is a defect", and AGENTS.md:214 gives an explicit repository convention precedence. The dispatch author applied neither precedence in the prompt, so the forbidden home looked sanctioned.

## How confirmed
Both dispatch prompts quote the `.tmp/` paths. The memory child reported that it remapped the pre-named targets and that the drafts predated the memory writes. Neither research child's report carried a mem: reference.
Source: dispatch author's observations and child interviews, 2026-11-21 retrospective.

## Prevention
The dispatch author names a memory name or a repository path as the deliverable target. `.tmp/` carries intermediates only and is never written as a deliverable. Where a large row set must ship as a file (task-delegation:142), the dispatch author sends the file to a repository path and the durable rows to memory.

Related: mem:cases/orchestration/research-not-memorized-retrospective, mem:cases/shell-denied-in-subtask
