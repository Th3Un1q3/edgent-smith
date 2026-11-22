---
id: cases/orchestration/cap-measured-in-wrong-unit
type: cases
scope: orchestration
status: active
confidence: 0.9
date: 2026-11-21
freshness: 2026-11-21
hotness: 0.65
ttl: 180d
provenance: "Memory child report and designer spend note, 2026-11-21 AIDLC research retrospective"
L0: "Two memories shipped 8-11k-char bodies against a 4,000c L1 cap so recall truncated, and a 1,900-word cap was measured with wc -w, which counts table pipes, costing four trim passes. Measure the cap unit with the tool that yields it."
---

# The cap measured in the wrong unit

## Symptom
Both promoted memories shipped 8-11k-character bodies against a 4,000-character L1 budget, so an L1 recall returned an excerpt instead of the memory. The design carried a 1,900-word cap, was measured with wc -w, and needed four trim passes.

## False hypothesis
A length limit is satisfied by trimming until the artifact looks short, and any counting tool reports the capped quantity.

## Root cause
The cap was applied after authoring by a proxy measurement whose unit was never compared with the cap unit. The memory writer wrote for completeness and never opened the disclosure budget (frontmatter.md:64 sets L1 at 4000c). wc -w counts whitespace-delimited tokens, and a markdown table whole rows are separated by spaces around each pipe, so many counted "words" were pipe characters; the number measured was not the number capped.

## How confirmed
The memory child report: "Bodies exceed the 4,000c L1 budget, so recall truncates". The designer spend note records the wc -w measurement and four trim passes against 1,900 words. frontmatter.md:64 states the L1 budget.

## Prevention
Name the cap, its unit and its measuring command in the return contract. Measure with the tool that yields the cap unit (wc -c or wc -m for characters; strip table syntax before counting words) and print the number before delivering. A body intended for L1 recall is authored to 4,000 characters, not trimmed to it afterwards.

Related: mem:cases/orchestration/unverified-length-from-stacked-edits