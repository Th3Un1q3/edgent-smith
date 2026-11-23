---
id: cases/orchestration/rule-specificity-incident-evidence-and-undefined-role
type: cases
status: active
date: 2026-11-23
scope: orchestration — a rule-authoring failure in retrospective work
hotness: 0.7
ttl: 365d
version: 1
freshness: 2026-11-23
directory: cases/orchestration
provenance: operator report 2026-11-23 of a retrospective rule rejected in review
related: mem:cases/orchestration/incident-rules-in-orchestrator-instead-of-memory, mem:cases/orchestration/undefined-reference-machine-judge-scope-creep
L0: "Retrospective rule named one session's binary and its size plus an undefined role; reviewer rejected it as uninterpretable. A rule names actor, observable, pass condition; incident detail goes to a case."
---

# A General Rule Carried Incident Evidence and an Undefined Role

## Symptom
While closing a retrospective action item, the author wrote a rule into `.agents/skills/task-delegation/SKILL.md` naming one session's repository-specific binary and its size, and handing a check to "the verifier", a role the skill never defines. A reviewer rejected the rule as overly specific and not interpretable.

## False hypothesis
That an incident's concrete detail makes a rule more actionable.

## Root cause
The retrospective asked for "the exact modification". The author read specificity as the evidence that occasioned the rule rather than the behaviour the rule must produce, so the rule bound a general instruction to one session's artifact and to a role no reader can locate.

## How confirmed
The reviewer's rejection names both failures: the binary and its size tell a future reader nothing to check in a different situation, and "the verifier" leaves the acting role unidentified.

## Prevention
The retrospective author writes a general rule as three parts — a defined actor, an observable, and a pass condition — and moves incident evidence into a case memory that the rule links with a `mem:` reference. The reviewer rejects a rule that carries session-specific artifacts or an undefined role.
