---
id: cases/orchestration/unverified-length-from-stacked-edits
type: cases
L0: "Two rounds reported an UNVERIFIED character count because edits were stacked behind one earlier measurement; measuring after the last edit and printing wc -c removed it."
hotness: 0.6
ttl: 365d
version: 1
freshness: 2026-11-15
directory: cases/orchestration
status: active
provenance: orchestration run 2026-11-15, two rounds of the design-contract authoring; producer interview
related: mem:experiences/orchestration/measurement-pass-before-draft-and-pinned-sections
---
# A length reported from a measurement taken before the last edit

## Symptom
Two judge rounds ended with the producer reporting the document length as UNVERIFIED. The number the report carried described the file as it stood before that round's edits, not after them.

## False hypothesis
The measurement surface was unavailable or the character budget had run out, so the length could not be taken and UNVERIFIED was the honest residue.

## Root cause
The producer measured once, then stacked several edits, then wrote its report from the earlier number without re-measuring. The report was therefore a claim about a superseded file version. Nothing in the report distinguished a measured value from a carried one, so the verifier could only return UNVERIFIED.

## How confirmed
Running `wc -c` after the final edit returned a different value from the one reported. After the instruction "measure before you report, not after" was given, the next round's reported number matched the post-edit measurement exactly.

## Prevention
Measure immediately after the last edit of the round, never before or around it, and print the command and its raw output inside the report. Never carry a number forward from an earlier state of the same file; if the measurement was not run after the final edit, the report says UNVERIFIED and names the edit that invalidated it.