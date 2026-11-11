---
id: cases/orchestration/resume-error-empty-error-text
type: cases
L0: "Resume returned error with an empty error and no output; relaunch fresh."
freshness: 2026-11-11
provenance: orchestrator run log 2026-11-11
---

# Error resume, empty error text

- Symptom: resume by task_id returned status "error", empty error, no output; unread and failed look identical; an interruption returns task_id plus partial output.
- False hypothesis: merely interrupted mid-turn, a retry would resume.
- Root cause: unknown, no error text; only the fast empty error return is observable.
- How confirmed: a fresh child with the same facts, binary path, and no-line-numbers note answered all four in 23 calls.
- Prevention: on empty-error "error", do not retry the resume; relaunch once as a fresh child with the established facts; never re-derive a prior report.

Source: orchestrator run log 2026-11-11.