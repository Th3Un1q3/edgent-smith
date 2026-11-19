---
id: projects/opencode-workflows/user-stories/US_06_generated_availability_line
L0: "US-06 Should: generate the availability line from declarations, append to entry prompts; remove five hand-written signal clauses and memory_required"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
status: superseded
provenance: SIGNALS-CONTRACT.md section 6
---
# US-06 — Generated availability line (superseded)

Superseded by projects/opencode-workflows/user-stories/US_06_display_signals_action on 2026-11-17. The display_signals action replaced the automatic append to entry prompts.

Priority: Should
Slice: 2
Contract: SIGNALS-CONTRACT.md section 6
Depends on: US-01, US-02

## Story

As the agent, I want every state prompt to end with the signals I may send and what each is for, derived from the declaration, so that I never read a stale instruction.

## Requirements

R1. core/signals.ts exports renderSignals(state): one declared signal renders "Signal now: NAME — describe"; two or more render "Signals now:" then one "- NAME — describe" line each in declaration order; none renders "Signals now: none".
R2. The line is appended to every emit.prompt sent by a state that declares at least one signal: define_goal entry, work entry, memorize entry, panic entering arm, and the idle follow-ups for work, validate and memorize.
R3. The hand-written signal clauses are removed from goal_request, work_towards_goal, memorize, panic_escalation and followUpText. Context prose stays.
R4. describe carries the actionable instruction and names the payload field where the schema has one (payload.goal, payload.text).
R5. validation_self_report is left unchanged: it addresses a validator child session, not the loop's own agent.
R6. The memory_required template id, its renderer and the two fallback arms in memorize and panic are deleted; a blank LESSON is refused before it reaches the actor.
R7. The unavailable_signal refusal renders the same string as the prompt line.
R8. No new template id is introduced.

## Acceptance criteria

AC1. Given define_goal, when its prompt is sent, then it contains "Signal now: SET_GOAL" and the describe mentions payload.goal.
AC2. Given work, when its entry prompt is sent, then it contains the CLAIM_WORK describe.
AC3. Given memorize or panic, when its prompt is sent, then it contains the LESSON describe with payload.text.
AC4. Given work and an idle event under the limit, when the follow-up prompt is sent, then it contains the generated line.
AC5. Given validate, when it dispatches, then the text does not contain "Signals now".
AC6. Given a blank LESSON, when sent in memorize, then it is refused as invalid_payload and no memory_required prompt exists.
AC7. Given a state with two signals, then both lines appear in declaration order.
AC8. Given an unavailable refusal, then its list matches renderSignals for the current state.

## How to demo

Proof mode: unit inspection of emitted prompt text, plus one live run for the agent-visible effect.

Run: just opencode::test -- plugins/tests/state-machine/signals.test.ts plugins/tests/state-machine.test.ts

Steps:
- open define_goal -> the synthetic prompt ends with 'Signal now: SET_GOAL — ... payload.goal'.
- move to work -> the entry prompt contains CLAIM_WORK and its describe.
- memorize and panic -> LESSON with payload.text.
- idle follow-up in work -> the line is present.
- validate dispatch -> no 'Signals now', because it addresses a child session.
- a blank LESSON is refused, and no memory_required prompt exists.

Live: the US-02 run shows the agent can proceed only by sending the advertised signal. Quote the prompt line if the log surfaces it; otherwise the unit assertion is the proof.

Does not prove: validation (US-02) or the gate message, which is unchanged by design.

## References

- .opencode/plugins/state-machine/core/machine.ts:101 PromptParameters
- .opencode/plugins/state-machine/core/machine.ts:332-357 prompt texts
- .opencode/plugins/state-machine/core/machine.ts:369 renderTemplate
- .opencode/plugins/state-machine/core/machine.ts:541-560 memorize arms
- .opencode/plugins/state-machine/core/machine.ts:571-580 panic arms
- .opencode/plugins/state-machine.ts:214 prompt descriptions
- .opencode/plugins/state-machine/SIGNALS-CONTRACT.md section 6

## Out of scope

No change to validation_self_report. No per-turn context block. No state split.