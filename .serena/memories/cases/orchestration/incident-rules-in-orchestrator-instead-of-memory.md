---
id: cases/orchestration/incident-rules-in-orchestrator-instead-of-memory
type: cases
status: active
date: 2026-11-10
scope: orchestration
provenance: user report 2026-11-10; rug.md Failure Modes diff in the same session
L0: "Incident rules landed in the orchestrator: the retrospective had no memory-first step, so rug.md Failure Modes grew per incident; fix: lessons are cases or method rules, with mem:cases/about as the pointer."
---

# Incident Rules in the Orchestrator Instead of Memory

## Symptom
After an incident, the orchestrator appended four per-incident bullets to the Failure Modes list in rug.md (`.opencode/agents/rug.md`). The list grows without bound and crowds the orchestrator's method rules: a reader can no longer tell method from anecdote, and every bullet costs context on every load.

## False hypothesis
"Capturing the failure mode in the orchestrator makes it stick." The bullets felt like durable enforcement because they sit in the always-loaded prompt.

## Root cause
- The retrospective template asked for atomic rules plus a harness diff, with no memory-first step.
- No compact pointer told the orchestrator that the failure catalogue lives in memory, so the prompt looked like the only place to put a lesson.
- No conclusion-time reminder fired, so the write landed wherever the template pointed.

## How confirmed
The user flagged the unbounded list. In the same session the orchestrator moved the four bullets to one mechanism rule and created the case index (mem:cases/about), which removed the per-incident list while keeping the lessons findable.

## Prevention
- The retrospective labels every lesson case or method.
- A case lesson is written under mem:cases/about and the cases/about index is updated.
- Only method rules are applied to the harness.
- goal.clear returns a memory-check reminder at conclusion time.
- Failure Modes in rug.md points at mem:cases/about instead of listing incidents.

## Secondary lesson
Temporary test artifacts (workspace-root test files, /tmp probes, .tmp scratch) must be removed before the final report.

Related: mem:cases/orchestration/research-not-memorized-retrospective (retrospective with no memory step, different subject).
Source: user report 2026-11-10; same-session rug.md diff.
