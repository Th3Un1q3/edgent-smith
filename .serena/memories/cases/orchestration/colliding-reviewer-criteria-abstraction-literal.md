---
id: cases/orchestration/colliding-reviewer-criteria-abstraction-literal
type: cases
L0: "Two adversarial passes on one document pulled opposite ways: a completeness verdict demanded the retired machine's event names in a table row, the next verdict failed the document because those names survived outside the delta. Keep the abstraction live, confine the literal to the delta, point at it from the table."
hotness: 0.6
ttl: 365d
version: 1
freshness: 2026-11-15
directory: cases/orchestration
status: active
provenance: orchestration run 2026-11-15, two adversarial review passes over one document authored in the same run
related: mem:cases/orchestration/countable-and-judgement-criteria-one-gate, mem:cases/criterion-widened-scope, mem:cases/orchestration/rename-sweep-unenumerated-legacy-names
---
# Colliding reviewer criteria resolved by separating abstraction from literal

## Symptom
Two adversarial passes over the same document returned opposite demands. Pass 1 (completeness) failed it because no table row documented the retired machine's event names. Pass 2 (history containment) failed it because those names had survived outside the historical delta section. Applying pass 2's fix re-opened pass 1's finding, and reverting re-opened pass 2's: each verdict was right under its own criterion.

## False hypothesis
That one reviewer had to be wrong, so the later verdict supersedes the earlier and the fix is to revert. Reverting the literal satisfied pass 2 and re-opened pass 1, so the loop could not close by choosing a side.

## Root cause
Both criteria were true of different layers of one text, and the document conflated them: the abstraction (the machine's role in the design) and the literal (its exact event names) sat in the same place. A completeness criterion reads for the literal; a history-containment criterion reads for the literal's absence outside the delta. One location cannot satisfy both, so no single edit settles the pair.

## How confirmed
The two verdicts were placed side by side: pass 1's failing location and pass 2's failing location were the same names in the same section. A structural change closed both — the live text kept the abstraction, the literal moved into the historical delta only, and the table row pointed at the delta instead of repeating the literal. Both failing criteria then passed against the changed text, with no further edits.

## Prevention
When two reviewers' criteria collide over one artifact, do not revert one fix with the other. Either separate the abstraction from the literal (abstraction in the live text, literal confined to the historical/appendix section, table pointing at it), or name explicitly which criterion wins for this artifact and record that choice with its reason. Confirm by re-checking both failing criteria against the changed text, not against either reviewer's wording.
