---
id: cases/orchestration/declared-param-not-threaded-to-write-and-read-sites
type: cases
L0: "An action wrote a hardcoded key instead of its declared store_in_key param, and the reader guard read a third key; param, write site and read site were never compared."
hotness: 0.8
ttl: 365d
version: 1
freshness: 2026-11-15
directory: cases/orchestration
confidence: 0.9
status: active
provenance: "orchestration run 2026-11-15 extending a design-contract document with three new actions; round 2 verdict"
related: mem:cases/payload-shape-consumer-coupling, mem:cases/orchestration/uncompiled-fence-first-verdict, mem:cases/orchestration/prose-reachability-unreachable-self-arm
---
# A declared parameter never threaded to its write and read sites

## Symptom
Round 2 verdict: one action wrote a hardcoded key instead of the `store_in_key` parameter it declared, and the reader guard read a different key again. Three names for one value, and no two of them agreed.

## False hypothesis
That these were two independent typos in two places, each fixable where the judge pointed, leaving the parameter plumbing untouched.

## Root cause
The parameter declaration, the write site, and the read site were never compared mechanically. Consistency was assumed from their proximity inside one fence and from the prose describing the action, so a parameter that existed only in its declaration passed as correct.

## How confirmed
The judge named the declaration and both use sites; grepping the key literals across the fence returns the hardcoded literal at the write site and a third literal at the read site, with the declared parameter referenced nowhere. A parameter cannot be unused and correct at the same time.

## Prevention
For every declared parameter, print one line per occurrence — declaration, each write, each read — with the literal used at that site, produced by grepping the parameter name and the key strings in the same fence. The write key and the read key must be the same expression or the same named constant. A parameter referenced only at its declaration is a defect on its own, reported before the verdict.

Related: mem:cases/payload-shape-consumer-coupling (grep every reader before changing a payload tag), mem:cases/orchestration/uncompiled-fence-first-verdict.
