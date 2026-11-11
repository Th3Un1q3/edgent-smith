---
id: cases/criterion-widened-scope
type: cases
L0: "Validator criterion 'no code path in .opencode/plugins/ reads SKILL.md' was wider than the request ('skills into subtasks'), failed an out-of-scope site, and cost a scope question."
hotness: 0.5
ttl: 180d
version: 2
freshness: 2026-11-11
directory: cases
provenance: operator report of the 2026-11-11 orchestration run
claim_ids: []
---

# Criterion widened past the request's scope

Source: operator report of the 2026-11-11 orchestration run; the run's transcripts were not available in this session, so each claim below is recorded as reported, not independently re-read.

## Symptom
A validator criterion read: no code path in `.opencode/plugins/` reads `SKILL.md`. It failed on a plugin site the operator had explicitly scoped out, and the run stopped to ask a scope question instead of judging the change.

## False hypothesis
A criterion is safer written wider than the request: a broader net cannot miss a real violation, so over-coverage costs nothing.

## Root cause
The criterion replaced the request's scope words with its own container path. The request scoped the behaviour to skills injected into subtasks; the criterion scoped it to every plugin path, so reads unrelated to the change counted as violations.

## How confirmed
The validator named the failing site. Placing the criterion text beside the request text showed the two scopes differed: request = the subtask injection path, criterion = the whole plugin tree. The failing site was outside the subtask path.

## Prevention
A criterion quotes the request's own scope words verbatim and names the out-of-scope ids explicitly as out of scope. Related: mem:cases/opencode/sdk_skills_injection, mem:cases/orchestration/child-evidence-before-verdict.