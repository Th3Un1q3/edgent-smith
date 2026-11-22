---
id: cases/shell-denied-in-subtask
type: cases
L0: "A child told to clone via shell hit \"Permission denied: shell\" on every git/curl call, spent its 24-call budget confirming it, and shipped 0 of 1 artifacts. Name the acquisition route the environment allows."
hotness: 0.5
ttl: 180d
version: 2
freshness: 2026-11-21
directory: cases
status: active
provenance: "Dispatch author's report of the 2026-11-21 dispatch"
claim_ids: []
---

# Shell denied in a subtask

## Symptom
The dispatch author sent a child agent to clone a GitHub repo and inventory it. The child's shell, curl and git calls were all rejected with "Permission denied: shell"; only pwd, ls and echo ran. The child delivered 0 of 1 artifacts.

## False hypothesis
The child treated the denial as transient and assumed a retried form would pass, so retrying cost less than reporting the block.

## Root cause
The dispatch author prescribed a shell clone as the acquisition step without knowing whether the child's environment permits shell; that environment allows GitHub gateway reads instead.

## How confirmed
The child's shell, curl and git calls all returned the same "Permission denied: shell" while pwd, ls and echo succeeded, so the denial was scoped to those executables. The child spent the rest of its budget on a GitHub-tree fallback.
Source: dispatch author's report of the 2026-11-21 dispatch.

## Prevention
The dispatch author names the route the environment actually allows before prescribing an acquisition command, or dispatches acquisition as a discovery question. The dispatch author tells the child that a denial is an acceptable, reportable outcome that ends that branch immediately, so the child does not spend budget on retries.

Related: mem:cases/subtask-partial-before-gates
