---
id: cases/orchestration/undefined-reference-machine-judge-scope-creep
type: cases
L0: "The doc never fixed which machine a runtime claim described and never defined unavailable, so each judge round legitimately read the claim against a different surface; two rounds came from that alone."
hotness: 0.6
ttl: 365d
version: 1
freshness: 2026-11-15
directory: cases/orchestration
status: active
provenance: orchestration run 2026-11-15 authoring a design-contract document, 7 judge rounds; producer interview
related: mem:cases/criterion-widened-scope
---
# Judge scope crept because the reference machine was never named

## Symptom
The judge's reading widened every round instead of settling: is the delta measured against the pasted machine or the wired machine? Does "unavailable" mean unavailable in this plugin's wiring or on the Context surface? Each answer was given, and the next round asked the same question one level over.

## False hypothesis
The judge was inventing new requirements, so the producer answered each widening as it arrived and treated the questions as noise rather than as a defect in the document.

## Root cause
The document made runtime claims without fixing the machine they describe, and used "unavailable" as a load-bearing term without a definition. Both readings were therefore correct against the text, so the judge could not converge: it was judging a genuinely ambiguous claim, not moving the goalposts. An unnamed reference surface makes scope creep unavoidable and each round looks like judge error.

## How confirmed
Two rounds closed only after the reference machine and the meaning of "unavailable" were written into the document. With both fixed, the judge stopped diverging and stopped re-reading the same claims against new surfaces.

## Prevention
Name every machine in play up front — the paste target and the wired runtime — and state which one each claim is about. Define each load-bearing term with the surface it refers to ("unavailable on the Context surface this plugin receives", not "unavailable"). A criterion that carries an undefined comparison has no verdict to converge on.