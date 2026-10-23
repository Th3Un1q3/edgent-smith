---
id: cases/orchestration/child-evidence-before-verdict
type: cases
L0: "Judge a child by its transcript not outputText; paste full verdicts; scope validators to the target path"
hotness: 0.6
ttl: 180d
version: 2
freshness: 2026-10-23
directory: cases/orchestration
provenance: "Observed RUG runs 2026-10-23 (brainstorm + ADR producer; rug-worker.md review loop)"
---
# Children are judged on transcript, not outputText

Problem: successive orchestration runs carried five evidence-handling defects, each costing a turn or a fix round.

1. Judge on transcript, not outputText. A child returned status ok with a 0-char outputText while its transcript held 4023 chars; the orchestrator read silence as failure. Tail the child before relaunching it.
2. Take task ids from the list. subtask_ls was never read, a fabricated task_id went to subtask_tail, and a whole turn was spent on the miss.
3. Pass verdicts whole. Validator reports were sliced to 1600-2000 chars in the orchestrator, cutting the judge challenge mid-item; the fix prompt lost finding 2 and an extra fix round was spent. Never feed a sliced verdict to a producer.
4. State read limits and validation scope in the prompt. Gateway snapshot caps truncated the scout's principle memories and the ADR producer's reads, forcing shell detours; a global validate-memories run failed on 351 pre-existing cache/ entries. Name the read limits and require target-path validation.
5. Never slice a verdict; tail it or pass it whole. A five-round review loop on .opencode/agents/rug-worker.md sliced each reviewer's findings to 2400 chars before the editor saw them; in two of five rounds the cut fell mid-item, losing a duplicate-pack rule once and a dead-reference finding once. The editor rejected each missing item for having no replacement text, costing two extra steps to recover. Pass the full verdict text, or tail it and pass the tail, never a slice. Instruct the editor that a truncated finding signals "ask for the remainder", not "reject it".

Evidence: brainstorm child ses_e9702e836ffeXwl3AJvJsT3Kha (empty outputText, 4023-char transcript, gateway round-trips before principles were confirmed); ADR producer ses_e97010b8bffeWtXXR80pAdSaKx (truncated judge report, 351 cache failures, two failed validations); orchestrator observations of sliced verdicts and the fabricated task_id; rug-worker.md review loop (2400-char slices, two mid-item cuts in five rounds, two extra recovery steps).

Source: observed RUG runs 2026-10-23; .opencode/agents/rug-worker.md review loop; mem:cases/opencode/subtask_tail_process_local; mem:experiences/truncated_envelope_compact_resume.
