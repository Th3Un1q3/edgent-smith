---
id: cases/spec-field-list-omits-invariant
type: cases
L0: "A manifest spec listed fields per signal but not the rule that every signal carries a JSON schema; three schema-less signals shipped though the request named schemas. A data spec states per-item fields plus cross-item invariants."
hotness: 1.0
ttl: 180d
version: 1
freshness: 2026-11-19
directory: cases
status: active
provenance: "retrospective reported by the orchestrator of the 2026-11 state-machine split run; recorded as reported"
claim_ids: []
---

# The spec enumerated fields and lost the invariant

## Symptom
A data implementer followed a manifest spec that listed, per signal, its name and describes, and produced three signals with no schema — while the request asked for "signals and their json schemas". The fresh validator failed the deliverable for the missing schemas.

## False hypothesis
That the implementer had ignored its spec: the spec was complete and the omission belonged entirely to the child.

## Root cause
The spec described items but not the contract over them. A per-signal field list is fully satisfiable without the one property the request named, and the request's own words ("and their json schemas") never became a spec line, so neither the implementer's brief nor the validator's criteria could measure it. Enumeration reads as completeness: once every field of every item is listed, the missing cross-item rule is invisible.

## How confirmed
The delivered manifest's signals carried no schema key; the spec listed fields per signal with no schema field and no schema rule; the validator's schema criterion failed against the delivered file.

## Prevention
A data spec carries two layers: the per-item field list and the cross-item invariants. Quote the request's nouns into the spec as checkable lines — "signals and their json schemas" is two artifacts, not one — and hand the validator that line as its criterion. Related: `mem:cases/criterion-universal-unmeasured` — the validator-side twin, where a shape universal was never measured against the items it describes.