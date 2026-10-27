---
id: lessons/delegated-read-only-discovery-truncation
type: experiences
L0: "Read-only discovery caps near 4000 chars: request a numbered section index plus sentinel, then sections in separate calls; resume truncation with a tail and a section-scoped resume, not a relaunch; sequence code and docs producers."
ttl: 180d
freshness: 2026-10-25
provenance: "orchestration retro, delegated read-only discovery run 2026-10-25 — child ses_e8bce3ba8ffeRbI3NJbnTok8mP and the truncated discovery envelope (sections 5-6 lost, sentinel missing)"
---
# Delegated read-only discovery: caps, resume, producer overlap

## Evidence

- A read-only discovery child returned more than the ~4000-character `outputText` cap per step; the first result came back `truncated: true`, losing sections 5-6 and the sentinel, and recovery cost a resume plus a tail.
- A code producer and a docs producer ran in parallel on the same change; the code producer read the docs producer's in-flight edit and concluded no doc change was needed.

## Rules

### 1. Index and sentinel before sections

`outputText` caps near 4000 characters per step. A discovery prompt asks for a numbered section index plus a closing sentinel (for example `END DISCOVERY`) and a one-line summary per section; full sections are requested in separate calls, one section per call.

### 2. Resume, do not relaunch

A result with `truncated: true`, or one whose sentinel is missing, is recovered by a tail of the same session plus a section-scoped resume request ("return sections 5-6 only"). Relaunching the discovery loses the work already paid for.

### 3. Sequence or scope the producer pair

A code producer and a docs producer that both write toward the same change run sequentially (docs after code), or each prompt names the other producer's files and states that an in-flight sibling edit is not evidence of the final state.

## Recovery ids

- An orchestrator branch that returns early on a failed, empty or truncated child result must still carry that child's task_id (and the sibling's) in the returned object; otherwise the only way back is listing children.
- In the observed run, three of four child listings existed solely to recover ids dropped by two early-return branches, so ids belong in every return path, not just the success path.
