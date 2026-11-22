---
id: cases/orchestration/work-sized-past-budget
type: cases
scope: orchestration
status: active
confidence: 0.9
date: 2026-11-21
freshness: 2026-11-21
hotness: 0.7
ttl: 180d
provenance: "Orchestrator run record and child interviews, 2026-11-21 AIDLC research retrospective"
L0: "A 33-entry inventory was dispatched inside a 24-call budget and wrote nothing; a later child spent 26 of 24 calls and stopped mid-close, because work volume was never converted to calls and the budget was never a stop condition."
---

# Work sized past the call budget

## Symptom
The inventory child was dispatched to open 33 top-level entries plus 8 directories with a 24-call budget; it wrote no file. A later retrospective child reported "spend: 26 / 24 (overrun by 2)" and stopped mid-close.

## False hypothesis
A completeness clause ("every top-level entry, each opened") is free, and a child that runs short will trim its own scope or return a partial unprompted.

## Root cause
Work volume was never converted into calls, and the budget was never a stop condition. The dispatch named 41 read units (33 bodies plus 8 directories) against 24 calls with no ceiling and no rank order, so the child had to spend its budget discovering the task was unwinnable. The child contract had no reserve rule either: its final calls went to production instead of to a file boundary and a report. task-delegation sizes a subtask by deliverable count and a budget share, and nothing in it counts read units against calls.

## How confirmed
The inventory child interview, question 2: "33 top-level entries requiring opened bodies versus 24 calls was unwinnable". One opened body costs at least one call, so 41 units cannot fit in 24. The retrospective child reported its own overrun. Both are in the 2026-11-21 orchestrator run record.

## Prevention
At dispatch, count read units and require units to be at most half the child calls, with an explicit ceiling and a rank order ("the first 8 by relevance, then stop"). In the child contract, the last three calls are reserve: stop producing at a file boundary and report partial. A completeness clause with no number attached is an unbounded scope.

Related: mem:cases/shell-denied-in-subtask, mem:cases/uncapped-discovery-report