---
id: claims/opencode/validator_scope_limits
type: claims
L0: "A fresh validator gets at most three claims and only their pages; nine criteria across nine pages left three unverified"
hotness: 0.7
ttl: 60d
version: 1
freshness: 2026-10-22
directory: claims/opencode
confidence: 0.9
status: active
provenance: RUG orchestration retrospective, verified 2026-10-22
---
# validator_scope_limits
fact: A fresh validation child can verify about three claims plus the pages those claims require within one budget.
scope: Scoping validation subtasks.
evidence: A validator given nine criteria across nine pages ended its budget with three criteria unverified — which reads as "unverified", not "false".
rule: Cap a validator at three claims and the pages that carry them; split larger validation across children.
Source: observed orchestration run, 2026-10-22; validator call accounting.
## Recurrence 2026-10-23

A memory validator was given five criteria over four memories and ran dry at criterion four, then reported FAIL for the artifact it never inspected.

Extended rule: split memory-content verification from git tree-state verification into separate, smaller checks, and cap the criteria per child. Anything unvisited is INCOMPLETE, never FAIL.
