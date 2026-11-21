---
id: cases/criterion-universal-unmeasured
type: cases
L0: "A criterion required {type, params} on every action and guard; three parameterless guards carried {type} only, as the source always had. Measure a shape universal against the existing items, then name the exception."
hotness: 1.0
ttl: 180d
version: 1
freshness: 2026-11-19
directory: cases
status: active
provenance: "retrospective reported by the orchestrator of the 2026-11 state-machine split run; source items not re-read in this session, recorded as reported"
claim_ids: []
---

# A shape rule written as a universal the data never had

## Symptom
A validator criterion required every action and guard item in the generated `machine.json` to carry `{type, params}`. Three parameterless guards legitimately carried `{type}` only, as the pre-split source always had. The criterion reported correct output as defective, and each finding had to be dismissed item by item.

## False hypothesis
That the three guards were incomplete: the implementer had dropped `params`, and the fix was to add an empty `params: {}` map to each of them.

## Root cause
The shape rule was generalized from the items that do carry params to every item, without ever being measured against the existing items it was meant to describe. `{type, params}` described a set that did not exist; the existing data — three parameterless guards — was the only thing that could have falsified it, and it was not read before the criterion was written.

## How confirmed
The three guard entries carried `{type}` with no params, and the source carried no params for those guards. A guard that takes no parameters has nothing to put in a params map, so the item shape is complete and the universal was the defect.

## Prevention
Before a shape rule becomes a criterion, enumerate the items it covers and read the existing ones; then state the rule with the exception it admits ("a parameterless guard carries `{type}` only") or narrow it to the items that carry params. The existing items decide a universal, not the sample the rule was drawn from. Related: `mem:cases/prompt-fork-decided-unasked` names the same rule for a universal handed to a child.