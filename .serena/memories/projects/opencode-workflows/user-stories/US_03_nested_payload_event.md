---
id: projects/opencode-workflows/user-stories/US_03_nested_payload_event
L0: "US-03 Must: carry decoded payload nested on the event; guards and record read event.payload fields; drop flattened goal/text"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: SIGNALS-CONTRACT.md section 4
---
# US-03 — Carry the decoded payload on the event

Priority: Must
Slice: 1
Contract: SIGNALS-CONTRACT.md section 4
Depends on: none
Unblocks: US-02
Status: implemented 2026-11-17 (Slice 1); tests in tests/state-machine/payload.test.ts

## Story

As the loop runtime, I want the decoded payload nested on the signal event, so that a guard or action reads only fields the state's schema declared and normalised.

## Requirements

R1. SignalRequest is {type: "agent_sent_signal.<ToolSignal>", payload?: unknown}.
R2. readPayloadField(event, field) reads event.payload[field] and returns an empty string for a non-object payload.
R3. RecordSource becomes {from:'payload', field} for signal-derived values; {from:'literal'} is unchanged.
R4. field_present reads the payload field.
R5. improvement_lesson checks intent only; the schema guarantees nonblank text.
R6. applyRecord and readSource use the payload lookup.
R7. Callback events keep {type, payload: CallbackPayload}; callback_ok and readCallback are unchanged.
R8. No top-level goal or text field is read anywhere.

## Acceptance criteria

AC1. Given SET_GOAL {goal:"ship"}, when the arm records, then context.goal is "ship".
AC2. Given LESSON {text:"lesson"}, when the arm records, then memories ends with "lesson".
AC3. Given LESSON {} in memorize, when the guard runs, then field_present is false.
AC4. Given callback.quality_check_ready {ok:true}, when callback_ok runs, then it is true and no payload-field read occurs.
AC5. Given a payloadless CLAIM_WORK, when the event is built, then payload is absent.

## How to demo

Proof mode: unit through the actor. The payload is internal, so the observable is context.

Run: just opencode::test -- plugins/tests/state-machine/signals.test.ts plugins/tests/state-machine.test.ts

Steps:
- start a rug machine, send {type:'SET_GOAL', payload:{goal:'ship'}} -> context.goal is 'ship'.
- in memorize, send LESSON {text:'lesson'} -> context.memories ends with 'lesson'.
- send LESSON {} -> field_present is false.
- send callback.quality_check_ready {ok:true} -> callback_ok is true, proving callback payloads still work.

Live, optional: the work prompt rendered after SET_GOAL contains 'Work towards: <goal>'. Quote it only when the run exposes the prompt; otherwise the unit assertion is the proof.

Does not prove: validation (US-02) or availability text (US-06).

## References

- .opencode/plugins/state-machine/core/machine.ts:113 RecordSource
- .opencode/plugins/state-machine/core/machine.ts:284 SignalRequest
- .opencode/plugins/state-machine/core/machine.ts:304 LoopEvent
- .opencode/plugins/state-machine/core/machine.ts:618 readEvent
- .opencode/plugins/state-machine/core/machine.ts:628 readSource
- .opencode/plugins/state-machine/core/machine.ts:631 applyRecord
- .opencode/plugins/state-machine/core/machine.ts:664 readCallback
- .opencode/plugins/state-machine/CONTRACT.md sections 3-6

## Example event

{ type: 'agent_sent_signal.SET_GOAL', payload: { goal: 'ship the parser' } }

## Out of scope

No validation (US-02). No change to callback payloads or the snapshot shape.