---
id: cases/orchestration/prose-reachability-unreachable-self-arm
type: cases
L0: "A state's entry raised unconditionally, so its IDLE self-arm was unreachable while prose claimed the state idles; reachability was reasoned in prose, not probed."
hotness: 0.8
ttl: 365d
version: 1
freshness: 2026-11-15
directory: cases/orchestration
confidence: 0.9
status: active
provenance: "orchestration run 2026-11-15 extending a design-contract document with three new actions; round 3 verdict"
related: mem:cases/orchestration/uncompiled-fence-first-verdict, mem:cases/orchestration/declared-param-not-threaded-to-write-and-read-sites, mem:cases/orchestration/quantifier-claim-falsified-by-one-line
---
# An arm declared but never reachable

## Symptom
Round 3 verdict: a state's entry action raised unconditionally, so the state's `IDLE` self-arm could never fire, while the surrounding prose described that state as idling.

## False hypothesis
That the transition table was complete and the defect sat in the prose sentence describing the idle behaviour, so editing that sentence would close it.

## Root cause
Reachability was reasoned about in prose, never probed. Every arm was checked for existence in the table; none was checked for a path that reaches it from the initial state past the entry guards. A table entry and a live transition are different facts.

## How confirmed
The judge walked the entry path: entry raises before any arm is offered, so no arm of that state is reachable, and the fence's own text contradicts the prose claim. Existence in the table was never evidence of reachability.

## Prevention
For every declared state and arm, name the transition that reaches it from the initial state, and probe the state machine by executing the fence against the initial context, or by a table walk that records reached states and the arms each offers. An arm with no reaching transition is deleted or its entry guarded; prose describing behaviour cites the arm that implements it; an unprobed transition table is reported `unverified`.

Related: mem:cases/orchestration/quantifier-claim-falsified-by-one-line (prose claims checked against an enumeration), mem:cases/orchestration/uncompiled-fence-first-verdict.
