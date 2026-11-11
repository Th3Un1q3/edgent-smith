---
id: cases/orchestration/self-graded-count-mismatch
type: cases
L0: "A producer's validation block claimed 'all 8 sites' while listing 9; the mismatch reached a validator round because nobody recounted the rows against the stated total."
hotness: 0.5
ttl: 180d
version: 2
freshness: 2026-11-11
directory: cases/orchestration
confidence: 0.9
status: active
provenance: "Orchestrator observation, 2026-11-11: the same read-only archaeology run that produced mem:cases/orchestration/citation-defects-four-fail-rounds."
---
# A self-reported count is not evidence

## Symptom

The first report's own validation block claimed "all 8 sites" while enumerating 9, and that unverified report passed into a validator round.

## False hypothesis

That the validation block's total was a check on the enumeration — that "all 8" proved the set had been counted and closed. It was a label carried over from the prompt, not a count of the rows.

## Root cause

The total was self-graded by the producer and nothing recounted the rows against it before dispatch; the prompt fixed no total, and the validator inherited the producer's number instead of deriving its own from the tree.

## How confirmed

The delivered report's validation block and its nine enumerated rows, counted side by side in the same report.

## Prevention

- Recount before dispatch: when a report states a total, the orchestrator counts the enumerated rows itself; a stated total that does not equal the row count sends the report back, not to the validator.
- Give the validator the unit and the sweep, not the producer's number; the validator derives its own count and fails the report when the two differ.
- Compatible with, not a replacement for, mem:cases/orchestration/delegated-report-completeness-contract: that rule makes truncation visible, this one makes a wrong total visible.

Harness home: `.agents/skills/task-delegation/SKILL.md`, "Prompts Carry Ground Truth, Not Line Numbers" — the validator-recount sentence in the "Exhaustive means counted" bullet.
