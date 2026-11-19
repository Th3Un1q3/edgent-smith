---
id: cases/uncapped-discovery-report
type: cases
L0: "A discovery report outran one result; a resume capped at <=1600 chars returned the usable facts. State the character cap at dispatch: the reader-budget rule already existed and was skipped."
hotness: 0.6
ttl: 180d
version: 1
freshness: 2026-11-16
directory: cases
status: active
provenance: "RUG orchestration run 2026-11-16; children ses_e1a18bb68ffeFNKxVJOPuDSgkb, ses_e1a18bb69ffeQgIkFmLzQ9uoUe; directory reads same run"
---
scope: cases — single failure plus fix; one overlong report and the cap that fixed it.

## Symptom
The discovery child's report exceeded what one result could carry. A second resume asking for a <=1600-char labelled digest produced the facts the next stage needed.

## False hypothesis
The child over-answered, so the fix belonged in the child's judgement rather than in the brief.

## Root cause
The dispatch named no reader budget. `task-delegation/SKILL.md:141` already requires one combined character cap covering table, prose and sentinel; nothing in the brief applied it, so the round was paid twice.

## How confirmed
Second resume on the same `task_id`, cap stated in the prompt, returned a usable digest. Source: orchestrator run observation 2026-11-16.

## Prevention
State the gross character cap and the section order at dispatch, and name the section a capped child may drop. On an overlong report, resume with the cap instead of re-reading the result or relaunching.
Distinct from `mem:cases/research-artifact-last-uncapped-fetch`, which records an uncapped fetch that left the artifact unwritten: that failure has no artifact, this one has an artifact too large to read.