---
id: claims/memory/third_read_arbitrates_disagreement
type: claims
L0: "when producer and validator disagree on an artifact's stored state, neither report is evidence: a third fresh session must quote the artifact verbatim before any fix, because both can be partly wrong in opposite directions"
hotness: 0.7
ttl: 60d
version: 1
freshness: 2026-10-23
directory: claims/memory
confidence: 0.9
status: active
provenance: 2026-10-23 session, producer/validator conflict over one memory artifact
---

# third_read_arbitrates_disagreement

fact: A producer and a validator reporting on the same artifact can both be wrong, in opposite directions.

scope: Any verify loop where one agent writes an artifact (memory, doc, config) and another reports its stored state.

evidence: 2026-10-23, one memory artifact. The producer reported "pointer appended, Decision unchanged"; the validator reported "no pointer and garbled Decision text". A third read showed the pointer did exist (the validator's read was stale) and the body carried an unrelated corrupted fragment ("terminologyAl") in a section the producer never opened. A fix ordered from the producer's claim alone would have appended a duplicate pointer and left the real corruption in place.

mechanism: The producer checked "no corruption" by reading only the two sections it had edited (Decision, References) and generalising to the whole body. Section coverage is not body coverage.

rule: When a producer and a validator disagree about stored state, order no fix until a third fresh session has quoted the artifact verbatim. Hold both reports as claims, not evidence, and record the quote before editing.

Source: 2026-10-23 session report of a producer/validator conflict on a single memory artifact. Related scope limits: mem:claims/memory/validator_baseline_scope.
