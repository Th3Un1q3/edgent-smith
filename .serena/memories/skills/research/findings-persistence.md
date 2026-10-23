# Findings must be persisted, not just reported

**Use when:** dispatching a research, inventory, or audit subtask whose value is the facts it discovers.

## Rule

A research or inventory subtask is not complete when it returns a report. Its acceptance criteria include a typed memory write: the findings land in Serena under the owning namespace, and the report carries the memory name plus its read-back size.

- A report without a `mem:` reference is incomplete, not done.
- "I will remember this" is not persistence; the transcript dies with the session.
- Prefer extending an existing memory that owns the topic over creating a near-duplicate.

## Why

Transcripts die with the session; memories are found and cited later. A run whose findings lived only in the orchestrator's context had to be interrupted mid-flight by the user:

> "One thing make researchers to capture their findings/facts into the memory, not just report to you."

## Acceptance shape

1. Memory name (namespace/slug) reported by the child.
2. Read-back size in bytes from `read_memory({memory_name})`.
3. A `mem:` reference in the report body.

## Evidence

2026-10-23 harness analysis: research children returned reports only; the finding set existed solely in the transcript until the user demanded persistence.