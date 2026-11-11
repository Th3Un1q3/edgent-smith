---
L0: "Research child burned 24 calls on fetches (github.com robots-blocked, 2 KB page slices) and never wrote its named brief; the artifact was ranked below six answers and no host or stop bound existed."
name: cases/research-artifact-last-uncapped-fetch
description: A research child spent its full 24-call window on portal fetches and never wrote the brief its prompt named; the artifact was ordered after six answers and no fetch surface was bounded.
type: cases
scope: cases
status: active
confidence: 0.8
timestamp: 2026-11-10
tags: [task-delegation, research, artifact-ordering, fetch-budget, context-gathering]
sources: [undefined]
---

# Research child: artifact never written

## Failure Modes

- **Symptom.** A delegated research child spent its whole 24-call window on portal fetches — github.com blocked by robots, page reads issued as 2 KB slices — and never wrote the brief named in its prompt. The scratch artifact did not exist on disk.
- **False hypothesis.** Naming the artifact anywhere in the brief is enough to get it written, and the child will bound its own fetching.
- **Root cause.** Ordering plus a missing surface bound. Six answers were ranked above the one artifact, no host or path surface was named, and no stop branch existed, so every blocked fetch and every slice read as progress. context-gathering/SKILL.md:46 caps each return at 2 KB; that bounds a payload, not a read strategy, and no rule says so.
- **How confirmed.** No artifact on disk and every recorded call in the fetch class (reported transcript, not replayed). The slice origin is derived, not observed: line 46 is the only 2 KB rule in the tree.
- **Prevention.** Add one bullet to context-gathering/SKILL.md, Principles: artifact first, fetch confined to the hosts and paths the brief names, fall back once and write the artifact after two failures against one host.

## Evidence

Source: session observations from the aidlc-workflows integration run (2026-11-10), read as data; context-gathering/SKILL.md:46 verified by grep this session.

## References

mem:cases/delegation-goal-gate-and-prompt-width — same run family, same unbounded-evidence hunt.