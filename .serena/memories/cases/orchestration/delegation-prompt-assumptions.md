---
id: cases/orchestration/delegation-prompt-assumptions
type: cases
L0: "A delegation prompt inherits the orchestrator's assumptions: an ADR lives in mem: rules plus the about index, not a repo file:line; a child catalog may lack the Serena gateway, so it is loaded before planning; a citation that disagrees with the tree is corrected, never made to fit a count."
hotness: 0.6
ttl: 90d
version: 1
freshness: 2026-10-23
directory: cases/orchestration
confidence: 0.9
status: active
provenance: RUG orchestration retrospective 2026-10-23; child ses_e95f8459 (ADR conventions), orchestrator ADR producer observation
---
# delegation-prompt-assumptions

fact: Three delegation prompts in the 2026-10-23 run carried a wrong assumption about the artifact or the tool surface, and each child spent its budget reconciling the prompt with the tree instead of producing the deliverable.

scope: RUG orchestrators writing discovery and authoring prompts in this repository.

evidence: ses_e95f8459 was told to report "registration steps (file:line)" for an ADR, but ADRs are memories whose only registration is mem: rules plus the about index, so it hunted repo docs that do not exist. The same child found the Serena gateway absent from its session catalog, so its calls went to failed name probes and a mid-task mcp-add. The ADR producer cited off-by-one line numbers and forced a grep count to match its own number, which a fresh validator caught across three rounds.

rule: Before dispatch, state where the artifact is registered in the form that artifact uses: a memory registers through mem: rules and the directory about index, a repo document through its path. Name the memory tool surface the child actually receives, and have it load the Serena gateway before planning rather than probing for it mid-task. When a cited line disagrees with the tree, re-read the line and correct the citation; never adjust the count to fit the number already written.

Source: observed RUG run 2026-10-23; complements mem:experiences/orchestration/measurement-pass-before-draft-and-pinned-sections, whose rule 6 requires re-reading citations at authoring time.