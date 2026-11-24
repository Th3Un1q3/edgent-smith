---
id: cases/orchestration/cap-measured-in-wrong-unit
type: cases
scope: orchestration
status: active
confidence: 0.9
date: 2026-11-21
freshness: 2026-11-24
hotness: 0.65
ttl: 180d
provenance: "Memory child report and designer spend note, 2026-11-21 AIDLC research retrospective; memory-proposal run record, 2026-11-24"
L0: "Two memories shipped 8-11k-char bodies against a 4,000c L1 cap so recall truncated; a 1,900-word cap was measured with wc -w; later a writer stopped before writing on a guard no gateway call applies, and one trimmed before drafting."
---

# The cap measured in the wrong unit

## Symptom
Both promoted memories shipped 8-11k-character bodies against a 4,000-character L1 budget, so an L1 recall returned an excerpt instead of the memory. The design carried a 1,900-word cap, was measured with wc -w, and needed four trim passes. In a later run a memory writer read the 4,000c L1 ceiling as a guard the gateway enforces, stopped before writing, and stored nothing; another writer spent its budget on character trimming before the first write.

## False hypothesis
A length limit is satisfied by trimming until the artifact looks short, any counting tool reports the capped quantity, and the cap is a precondition that must be satisfied before the first write.

## Root cause
The cap was applied at the wrong point of the work, by a proxy measurement whose unit was never compared with the cap unit. The memory writer wrote for completeness and never opened the disclosure budget (frontmatter.md:64 sets L1 at 4000c). wc -w counts whitespace-delimited tokens, and in a markdown table the pipes sit between spaces, so many counted "words" were pipe characters. The later failures apply the cap at the wrong point too: one treats a delivery check as a pre-write gate that no gateway call applies, and one trims an unwritten draft.

## How confirmed
The memory child report: "Bodies exceed the 4,000c L1 budget, so recall truncates". The designer spend note records the wc -w measurement and four trim passes against 1,900 words. frontmatter.md:64 states the L1 budget. The later run's reports show one writer stopping with no body stored and one spending calls on trim passes before a draft existed.

## Prevention
Name the cap, its unit and its measuring command in the return contract. Measure with the tool that yields the cap unit (wc -c or wc -m for characters; strip table syntax before counting words) and print the number before delivering. Author each section to its share of the 4,000 characters as you write; when the finished draft still overflows, trim in place with wc -c rather than re-drafting, and never trim before the first write. The ceiling is checked at delivery, so a writer that stops before the first write withholds the work.

Related: mem:cases/orchestration/unverified-length-from-stacked-edits, mem:cases/orchestration/gate-skipped-to-save-a-call
