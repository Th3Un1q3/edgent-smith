---
id: cases/orchestration/countable-and-judgement-criteria-one-gate
type: cases
L0: "One acceptance list mixing countable checks with judgement checks never goes green in one pass: six judge rounds each closed a countable item and opened a new framing defect."
hotness: 0.6
ttl: 365d
version: 1
freshness: 2026-11-15
directory: cases/orchestration
status: active
provenance: orchestration run 2026-11-15 authoring a design-contract document, 7 judge rounds; producer interview
related: mem:cases/orchestration/must-have-criterion-category-mismatch
---
# Countable and judgement criteria in one gate never converge

## Symptom
A design-contract document ran 7 judge rounds. Six of them were monotonic — each closed criteria the previous round had opened — yet no round ended all-green: every round closed a countable item and surfaced a fresh framing defect in the prose.

## False hypothesis
The rounds were converging, so the next round would close the remainder. Monotonic progress was read as imminent pass, and each round was dispatched with the same single acceptance list.

## Root cause
One acceptance list mixed countable checks (row counts, character count) with judgement checks (how runtime claims are framed). A countable check is closed by measuring and stays closed. A judgement check is closed only by re-reading prose, and every prose rewrite that satisfies it creates new framing surface. With both in one gate, the gate cannot be satisfied in one pass by construction — the countable half is always done before the judgement half has been read once.

## How confirmed
The round-by-round ledger splits cleanly: every criterion closed in any round was countable; every criterion opened in any round was a framing judgement. No round closed a judgement criterion without opening another. Splitting the list stopped the ratchet.

## Prevention
Split the acceptance list into two gates. Countable gate: each item names its command and prints the value. Judgement gate: each item quotes the exact sentence it judges and the framing it requires. Freeze the criterion set before round 1; a judgement criterion may not enter the list without the sentence it will read.