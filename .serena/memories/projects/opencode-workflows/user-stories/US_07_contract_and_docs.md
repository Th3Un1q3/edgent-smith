---
id: projects/opencode-workflows/user-stories/US_07_contract_and_docs
L0: "US-07 Should: fold SIGNALS-CONTRACT into CONTRACT.md and update plugin conventions after both slices land"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: SIGNALS-CONTRACT.md sections 11, 13
---
# US-07 — Fold the contract and update docs

Priority: Should
Slice: 2
Contract: SIGNALS-CONTRACT.md sections 11 and 13
Depends on: US_01 through US_06
Status: implemented 2026-11-17; gate metadata added; SIGNALS-CONTRACT reduced to a pointer

## Story

As a maintainer, I want one binding contract describing the shipped machine, so the next change does not have to reconcile a proposal against the code.

## Requirements

R1. CONTRACT.md section 2 states that agent_sent_signal events carry {type, payload}; the flattened goal/text description is removed.
R2. CONTRACT.md section 4 lists each state's signals with describe and schema summary; SET_GOAL and LESSON carry schemas; CLAIM_WORK, GOAL_ACHIEVED and GOAL_INCOMPLETE are payloadless.
R3. CONTRACT.md section 5 changes the record source to {from:'payload', field}.
R4. CONTRACT.md section 6 updates field_present and improvement_lesson to payload reads.
R5. CONTRACT.md section 9 records the tool_blocked metadata and keeps the authored message.
R6. CONTRACT.md section 12 adds the signal validation decisions and removes the parseSignal description.
R7. SIGNALS-CONTRACT.md is reduced to a status line pointing at CONTRACT.md; it stops being a second authority but keeps the path valid.
R8. .opencode/plugins/AGENTS.md state-machine conventions gain one rule: signals are declared per state and the load-time invariant throws on drift.
R9. A repository search finds no live references to parseSignal, GOAL_REQUIRED_MESSAGE, TOP_LEVEL_KEYS or memory_required outside history and this story set.

## Acceptance criteria

AC1. Given CONTRACT.md, when section 2 is read, then it describes the nested payload.
AC2. Given the repository, when parseSignal is searched, then only the proposal's history section or no result remains.
AC3. Given SIGNALS-CONTRACT.md, then its status points at CONTRACT.md and it states no independent rules.
AC4. Given .opencode/plugins/AGENTS.md, then the conventions table bullet names the load-time invariant.
AC5. Given the docs, then no section claims a phase field, substate or dynamic tool schema.

## How to demo

Proof mode: inspection only. No runtime claim.

Commands:
- grep -n 'payload' .opencode/plugins/state-machine/CONTRACT.md -> section 2 describes {type, payload}, with no flattened goal/text description.
- grep -rEn 'parseSignal|GOAL_REQUIRED_MESSAGE|memory_required' .opencode/plugins/state-machine .opencode/plugins/tests -> only historical mentions remain.
- read SIGNALS-CONTRACT.md -> its status points at CONTRACT.md and it states no independent rules.
- read .opencode/plugins/AGENTS.md -> the per-state declaration and load-time invariant rule is present.

Does not prove: code correctness; the US-01 to US-06 tests do.

## References

- .opencode/plugins/state-machine/CONTRACT.md sections 2, 4, 5, 6, 9, 12
- .opencode/plugins/state-machine/SIGNALS-CONTRACT.md
- .opencode/plugins/AGENTS.md state machine plugin conventions
- .opencode/instructions/comments.instructions.md

## Implementation note

The fold closed one gap: the policy gate now adds metadata { code: tool_blocked, tool, state, allowed_tools } to its Tool.Error, matching the contract. A repository search for parseSignal, GOAL_REQUIRED_MESSAGE, TOP_LEVEL_KEYS and memory_required returns nothing.

## Out of scope

No code change. No new ADR. No rewrite of unrelated CONTRACT sections.