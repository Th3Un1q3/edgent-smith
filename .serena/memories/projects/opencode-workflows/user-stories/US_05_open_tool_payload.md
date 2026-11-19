---
id: projects/opencode-workflows/user-stories/US_05_open_tool_payload
L0: "US-05 Must: open the signal_send payload to an arbitrary object; remove goal/text hints; tool surface stays fixed per registration"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: SIGNALS-CONTRACT.md section 10
---
# US-05 — Open the tool payload

Priority: Must
Slice: 1
Contract: SIGNALS-CONTRACT.md section 10
Depends on: US-02, US-03
Status: implemented 2026-11-17 (Slice 1); registration test

## Story

As the agent, I want the signal_send tool to accept the fields the current state declares, not a fixed pair of hints, so that I can send any declared signal without the tool schema lying about its payload.

## Requirements

R1. signalInput.properties.payload becomes {type:'object'} with no properties and no additionalProperties restriction.
R2. The goal and text properties are removed from the tool input.
R3. The top level keeps additionalProperties false and required ['type'].
R4. Descriptions state that type is the advertised signal and payload holds the fields that signal declares.
R5. options.codemode stays true.
R6. The hand-written prompt clauses stay in place until US-06 lands, so guidance exists between slices.

## Acceptance criteria

AC1. Given the registered tool, when its input is inspected, then payload has no goal or text property and does not forbid additional properties.
AC2. Given the registered tool, when its input is inspected, then the top level still rejects an unknown key other than payload.
AC3. Given a call with payload {unit:"parser"}, when the tool input validates, then it is accepted and reaches validateSignal.
AC4. Given the registration, then options.codemode is true.

## How to demo

Proof mode: unit inspection of the registered tool input, plus the live US-02 run for the open payload.

Run: just opencode::test -- plugins/tests/state-machine.test.ts
Expect: harness.tools.get('signal_send').input has payload with no goal or text properties and no additionalProperties:false; the top level still has additionalProperties:false and required ['type']; options.codemode is true.

Live, shared with US-02: the SET_GOAL call carries payload.goal through the tool and reaches validation; a payloadless signal with a junk payload is accepted and drops it. That proves the tool input did not reject an undeclared field.

Does not prove: that each per-state schema is correct (US-01 and US-02).

## References

- .opencode/plugins/state-machine.ts:52 signalInput
- .opencode/plugins/state-machine.ts:272 tool transform
- .opencode/plugins/tests/state-machine.test.ts:43-48 registration assertions
- .opencode/plugins/state-machine/SIGNALS-CONTRACT.md section 10

## Example input

{
  type: 'object',
  required: ['type'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', description: 'The signal to send.' },
    payload: { type: 'object', description: 'Fields declared for that signal by the current state.' },
  },
}

## Out of scope

No dynamic tool schema per state. No change to the tool name, code-mode option, or execute signature.