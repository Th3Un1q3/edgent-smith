---
id: cases/ts-excess-property-computed-keys
type: cases
L0: "TypeScript skips excess-property checks on computed keys: an `on` map keyed by computed event names accepts a bogus event, so a mistyping experiment proves nothing about those keys unless it uses a literal key."
hotness: 0.6
ttl: 180d
version: 1
freshness: 2026-11-17
directory: cases
status: active
provenance: "RUG orchestration run 2026-11-17; child ses_e17710f39ffeRaIU0Lr3T9fGJj (xstate types)"
---
scope: cases — single failure plus fix; one verification technique against one type-system gap.

## Symptom
The child set out to prove that an invalid event key is rejected in every state of an xstate machine whose `on` maps are built from computed event keys. Its mistyping experiment compiled: a bogus event name was accepted where the same object typed with literal keys rejects it. The acceptance criterion "event-key rejection proven" therefore had no evidence behind it, and the run could not tell a passing type from an unchecked one.

## False hypothesis
A mistyped event name is rejected wherever event keys are typed, so one mistyping suffices to prove rejection in every state. The compiler's silence was read as "the map is permissive by design" rather than "this check does not apply to this key form".

## Root cause
TypeScript skips excess-property checking for computed keys. An object literal whose property names come from a computed expression is not checked against the target type's known keys, so an unknown event name enters the map unnoticed. Excess-property rejection is a property of literal keys, not of the map's declared type; the experiment exercised a different check from the one the criterion named.

## How confirmed
Reported by the child while typing the machine (ses_e17710f39ffeRaIU0Lr3T9fGJj): the mistyping compiled, and the child named the skipped excess-property check as the cause. Not re-run in this session; the child recommended testing the excess-property behaviour of the literal shape first.

## Prevention
Prove the rejection against a literal key shape before trusting any mistyping experiment: write the same event name into an object literal with literal keys and observe the compiler reject it, then treat computed-key maps as unchecked for that name. When the map must stay computed, add a check that does not depend on excess-property rules — a keyed lookup, a `satisfies` against an enumerated key union, or a type-level assertion whose failure is visible. State in the acceptance criterion which of the two forms the proof uses.