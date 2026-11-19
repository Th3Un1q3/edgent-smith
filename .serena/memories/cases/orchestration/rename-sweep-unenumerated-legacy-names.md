---
id: cases/orchestration/rename-sweep-unenumerated-legacy-names
type: cases
L0: "A rename shipped without enumerating its legacy identifiers, so the no-legacy-name-survives claim stayed unverifiable until a later grep pass; list the old names first and assert zero hits per name in the same round."
hotness: 0.6
ttl: 365d
version: 1
freshness: 2026-11-15
directory: cases/orchestration
status: active
provenance: orchestration run 2026-11-15 auditing a design-contract document after an event-taxonomy rename
related: mem:cases/orchestration/quantifier-claim-falsified-by-one-line
---
# A rename whose legacy names were never enumerated

## Symptom
The design contract replaced five event types (START_WITH_GOAL, CONFIRM, IDLE_LIMIT, SIGNAL, IDLE) with three prefixed families and asserted that no unprefixed event type survived. The assertion could not be checked: no list of the old names existed, so no command could return a zero hit per name. The claim stayed unverifiable until an audit round recovered the old names from the wired transition list and the delta table.

## False hypothesis
The rename was complete because the event union and every transition key had been rewritten, so the only check needed was a read of the machine block.

## Root cause
The sweep was asserted, not enumerated. A rename claim quantifies over the old names, but the writer listed only the new ones, so no artifact recorded which strings counted as legacy. Legacy names could survive in every region the union does not cover: the liveness table, the action and guard catalogs, the prompt templates, and the prose.

## How confirmed
The audit recovered the five old names from the wired transition list and the historical delta rows, then grepped the non-delta region of the document once per name: zero hits, with the only survivors inside the delta rows the criterion allows. The same command applied to the pre-rename text returns all five names, which shows the sweep can fail as well as pass.

## Prevention
A rename claim names the old identifiers first, in one list, then prints the command and the zero-hit result per name in the same round. State the sweep boundary (files or line range) and the regions it covers, so a reader can tell an unsearched region from a clean one.