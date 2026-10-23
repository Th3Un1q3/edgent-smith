---
id: experiences/provenance_stamp_in_document_body
type: experiences
L0: "A verification obligation aimed at a child's return report was applied to the document body, so a date stamp stood in for the quoted call output the rule actually demanded."
version: 1
freshness: 2026-10-23
provenance: root-cause review of gateway-protocol.md line 57
---

# Provenance stamps leak into document bodies

## Root cause

An instruction about evidence belonged to the report the child returns to the orchestrator, but nothing in it limited the scope. The child carried the obligation into the document it was editing, so a rule file gained a sentence about when someone checked it.

## Mechanism

1. The governing rule (see `experiences/doc_claims_quote_observed_output`) demands that a claim about a tool signature travel with its observed output in the same diff.
2. That output lives naturally in a return report. A document body has no slot for it.
3. The child satisfied the letter of the rule with a date stamp: `Verified 2026-10-23 in a live session; call the flat gateway tools directly.`
4. The stamp is unfalsifiable, rots on the next change, and replaces the rule the reader needs with a record of an author's afternoon. The section it heads then keeps mixing measured observations into prose.

## Correct instruction wording

"In your report to me, state what you ran and quote the observed output. In the document, write only the rule that governs future readers: no dates, no session references, no provenance stamps."

## Pattern to grep

`verified 2026|verified in a live session|confirmed on 2026|as of this session|tested today`

## Scope

Applies whenever a delegation prompt carries evidence rules, and to any doc a later agent copies verbatim.
