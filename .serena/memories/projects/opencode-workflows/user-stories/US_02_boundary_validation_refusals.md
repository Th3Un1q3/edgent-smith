---
id: projects/opencode-workflows/user-stories/US_02_boundary_validation_refusals
L0: "US-02 Must: validate shape, vocabulary, declaration, payload in order; refuse via Tool.Error message + metadata (unknown/unavailable/invalid)"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: SIGNALS-CONTRACT.md sections 3, 5
---
# US-02 — Validate signals and refuse with guidance

Priority: Must
Slice: 1
Contract: SIGNALS-CONTRACT.md sections 3 and 5
Depends on: US-01, US-03
Status: implemented 2026-11-17 (Slice 1); live refusal-then-acceptance observed

## Story

As the agent driving the session loop, I want a refused signal to tell me which class of mistake I made and what to send instead, so that I can correct it in the same turn without guessing.

## Requirements

R1. validateSignal(input, state, signals) lives in core/signals.ts and returns either {ok:true, event, payload} or {ok:false, refusal}.
R2. Order: shape, vocabulary, declaration, payload. Stop at the first failure.
R3. Shape: input is an object whose only keys are type and payload; type is a nonblank string; payload, when present, is a plain object.
R4. Vocabulary: type in TOOL_SIGNALS, else unknown_signal with the full vocabulary in the message.
R5. Declaration: signals[type] exists in the current state, else unavailable_signal with the declared list and each describe.
R6. Payload: decode with onExcessProperty error; each issue becomes {path: "payload.<key>", expected: "<short phrase>"}; example rendered when present.
R7. A payloadless spec accepts and drops the payload; the event carries none.
R8. The plugin maps a refusal to Tool.Error with message and metadata; the core does not import the tool SDK.
R9. Metadata keys exactly: code, signal, state, available_signals, and schema_validation_error for invalid_payload.
R10. Delete parseSignal, GOAL_REQUIRED_MESSAGE, TOP_LEVEL_KEYS and the manual trim in signal().

## Acceptance criteria

AC1. Given define_goal and CLAIM_WORK, when sent, then Tool.Error metadata code is unavailable_signal, signal is CLAIM_WORK, available_signals is [SET_GOAL], and the message lists SET_GOAL with its describe.
AC2. Given PUSH_WORK, when sent, then code is unknown_signal and the message lists the whole vocabulary.
AC3. Given SET_GOAL with payload {goal: 42}, when sent, then code is invalid_payload and schema_validation_error is [{path:"payload.goal", expected:"string"}].
AC4. Given SET_GOAL with {goal:"  ship  "}, when accepted, then the recorded goal is "ship".
AC5. Given SET_GOAL with {goal:"   "}, when sent, then code is invalid_payload at payload.goal.
AC6. Given CLAIM_WORK with an arbitrary payload, when sent from work, then the event has no payload and the move succeeds.
AC7. Given any refusal, when the agent retries with a valid signal, then the retry succeeds in the same turn.
AC8. Given a refusal, then metadata and message carry the same facts.

## How to demo

Proof mode: registered-tool unit tests, then one live agent run. The live run is the real proof because the error crosses the Code Mode boundary.

Precondition: just opencode::test -- plugins/tests/state-machine/signals.test.ts plugins/tests/state-machine.test.ts passes.

Registered-tool demo (harness.runTool, not validateSignal directly):
- CLAIM_WORK in define_goal -> Exit failure, metadata.code 'unavailable_signal', message lists SET_GOAL with its describe.
- SET_GOAL payload {goal: 42} -> 'invalid_payload', schema_validation_error [{path:'payload.goal', expected:'string'}].
- SET_GOAL payload {goal:'  ship  '} -> state work, context.goal 'ship'.
- CLAIM_WORK with {junk:true} in work -> accepted, event payload absent.

Live demo:
opencode run --format json --standalone --agent rug --model <authenticated-route> --print-logs 'Call tools.signal_send with type CLAIM_WORK. Quote the error verbatim. Then call tools.signal_send with type SET_GOAL and payload {"goal":"report the first line of AGENTS.md"}. Then reply exactly DONE.' 2>&1

Expect: the first call fails with 'CLAIM_WORK is not available in define_goal.' and the SET_GOAL line; the second returns 'Signal accepted.' and the work prompt follows; execute.before lines show both calls.

Observed 2026-11-17 with opencode-go/deepseek-v4.1-flash, agent rug: signal_send status error with 'CLAIM_WORK is not available in define_goal.' and '- SET_GOAL — State the goal this session must accomplish, in payload.goal.'; then signal_send status completed with 'Signal accepted.'; execute.before lines tool=signal_send keys=type and keys=type,payload. The run later hit a pre-existing 'Agent not found: validator' failure when the loop reached validate; that is outside this story.
On provider auth failure: quote the exact error and record the live check as unrun. Never record a pass.

Does not prove: guard or action payload reads (US-03) or the generated prompt line (US-06).

## References

- .opencode/plugins/state-machine/core/machine.ts:828 GOAL_REQUIRED_MESSAGE
- .opencode/plugins/state-machine/core/machine.ts:943 parseSignal
- .opencode/plugins/state-machine/core/machine.ts:1138 signal
- .opencode/plugins/state-machine.ts:278 tool execute
- .opencode/node_modules/@opencode/schema/dist/tool.d.ts:35-40 Tool.Error message, error, metadata
- .opencode/plugins/state-machine/SIGNALS-CONTRACT.md sections 3 and 5

## Example metadata

{"code":"unavailable_signal","signal":"CLAIM_WORK","state":"define_goal","available_signals":["SET_GOAL"]}

## Out of scope

No prompt generation (US-06). The gate keeps its authored message and gains only tool_blocked metadata.