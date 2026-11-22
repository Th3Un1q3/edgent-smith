---
id: cases/orchestration/rendering-read-as-artifact
type: cases
L0: "wc -w counted table pipes, a citation used the gateway read prepended line (217 for 213), and a verifier nearly judged a display-truncated body. Each check read a rendering, not the artifact."
hotness: 0.5
ttl: 180d
version: 1
freshness: 2026-11-21
directory: cases/orchestration
status: active
confidence: 0.9
provenance: "Orchestrator run record of the 2026-11-21 aidlc research run; F10, F11, F12; the design trim passes, the explainer citation, and the memory verifier re-read"
---
# The rendering is not the artifact

## Symptom
The drafting child took three observations from a rendering and treated them as the artifact. A word count from wc -w counted markdown table pipe characters, so a document met its 1900-word cap only after four trim passes. The drafting child cited docs/reference/07-sensor-system.md:217 for a count stated at :213. A memory verifier's terminal view of a body was cut by the display cap while the read behind it was complete, and the verifier nearly judged the truncated text.

## False hypothesis
That the tool output is the object: that wc -w counts words, that the line numbers a read displays are the file line numbers, that the body on screen is the body stored.

## Root cause
Each check passed through a transformation the drafting child did not account for - a tokenizer that counts pipes, a gateway read that prepends a download-status line, a display cap that cuts at N chars - and the drafting child absorbed the small discrepancy rather than reconciling it. The drafting child never recorded which layer produced the number, so nothing distinguished a measurement of the artifact from a measurement of its rendering.

## How confirmed
The count is stated at file line 213; the cited 217 sits four lines later, matching the prepended status line in the gateway read. wc -w counts each pipe as a token on a table row. The verifier found its error only by re-reading the saved full output, where the body continued past the truncation.

## Prevention
- The drafting child measures with the unit the constraint names: prose words for a word cap (strip table syntax first), bytes for a byte budget, file line numbers for a citation.
- The drafting child takes line numbers from the source file. When only the gateway rendered read is available, it subtracts the prepended status line, or greps the exact sentence and cites what grep returns.
- The verifier verifies from the saved full output; it treats the display cap as a rendering boundary and re-reads the file when the body ends exactly at the cap.

Related: mem:cases/orchestration/citation-defects-four-fail-rounds, mem:cases/orchestration/unverified-length-from-stacked-edits
