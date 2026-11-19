---
id: projects/opencode-workflows/user-stories/US_01_signal_declaration_model
L0: "US-01 Must: per-state signal specs (describe + Effect Schema + examples) inline in SESSION_LOOP; implemented 2026-11-17"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: SIGNALS-CONTRACT.md sections 2, 7
---
# US-01 — Declare per-state signal specs

Priority: Must
Slice: 1
Contract: SIGNALS-CONTRACT.md sections 2 and 7
Depends on: none
Unblocks: US-02, US-04, US-06
Status: implemented 2026-11-17 (Slice 1); tests in tests/state-machine/signals.test.ts

## Story

As the maintainer of the session loop, I want each state to declare the signals it accepts with a payload schema, a one-line instruction and an example, so that validation, availability text and agent guidance come from one source.

## What changes (in scope)

Files touched:

- core/signals.ts, new: exports the SignalSpec type only. validateSignal arrives in US-02, renderSignals in US-06, assertSignalDeclarations in US-04.
- core/machine.ts: the LoopState type gains a signals block; SESSION_LOOP gains the five declarations below; SET_GOAL and LESSON schemas gain examples.
- tests/state-machine/signals.test.ts, new: schema decode tests plus a presence test for the five declarations.

Declarations:

- define_goal: SET_GOAL, schema {goal: trimmed, min length 1}, example {"goal":"ship the parser"}.
- work: CLAIM_WORK, describe only.
- validate: GOAL_ACHIEVED and GOAL_INCOMPLETE, describe only.
- memorize: LESSON, schema {text: trimmed, min length 1}, example {"text":"run typecheck before claiming done"}.
- panic: LESSON, same schema as memorize. The schema is declared per state; sharing a const is allowed but the declaration stays in both blocks.

Behaviour at the time of this story: none changes, and nothing reads signals. US-03 then carried the payload on the event and US-02 made the schemas load-bearing; the declarations added here are now read by validateSignal.

## Requirements

R1. core/signals.ts exports SignalSpec with describe (required, nonblank) and schema (optional, Schema.Top).
R2. The LoopState type gains a signals block keyed by ToolSignal.
R3. SESSION_LOOP declares exactly the five blocks listed above.
R4. SET_GOAL decodes {goal}, trimmed, minimum length 1; example in the schema examples annotation.
R5. LESSON decodes {text}, trimmed, minimum length 1; example in the schema examples annotation.
R6. CLAIM_WORK, GOAL_ACHIEVED and GOAL_INCOMPLETE declare describe only and no schema.
R7. describe is one imperative sentence, at most 160 characters, and names the payload field where one exists (payload.goal, payload.text).
R8. Declarations stay inline in SESSION_LOOP; only SignalSpec lives in core/signals.ts.
R9. toStateConfig keeps copying only entry, exit and on: signals never reaches XState.
R10. acceptedTransitions is unchanged and still derives from on.

## Acceptance criteria

AC1. Given define_goal, work, validate, memorize and panic, when their signals keys are read, then they are exactly the sets above. This is a presence test, not the load assertion; US-04 owns the bijection.
AC2. Given SET_GOAL, when decoded with "  ship  ", then goal is "ship".
AC3. Given SET_GOAL, when decoded with "   ", then decoding fails and the issue path is goal.
AC4. Given LESSON, when decoded with text 42, then decoding fails and the issue path is text.
AC5. Given a payloadless spec, when inspected, then schema is absent and no example exists.
AC6. Given every spec, when inspected, then describe is nonblank after trimming.
AC7. Given the JSDoc/type surface, when the module is inspected, then no function in core/signals.ts exists except the SignalSpec type.

## Out of scope, with owner and reason

| Not in this story | Owner | Why it is not needed here |
|---|---|---|
| validateSignal, the three refusal classes, Tool.Error mapping | US-02 | The declarations are data; no code path reads them yet, so validation cannot exist before the data does. |
| readPayloadField, nested event payload, record source {from:'payload'} | US-03 | The event shape is orthogonal to authoring schemas. US-01 leaves parseSignal and the flattened goal/text path untouched. |
| assertSignalDeclarations called at load, throwing on drift | US-04 | The invariant needs declarations to assert against. US-01 proves presence in a test; US-04 proves the bijection and fails the load. |
| Opening the tool payload, removing goal/text hints | US-05 | The tool input is independent of the declarations. Keeping the hints preserves current guidance for one more slice. |
| renderSignals, generated prompt lines, template edits | US-06 | The current hand-written sentences are still true for these five signals; they are replaced when the renderer exists. |
| CONTRACT.md edits, folding the proposal, AGENTS.md rule | US-07 | The shipped behaviour has not changed, so the binding contract must not change yet. |
| Live rug run | US-08 | Nothing observable changed, so there is nothing live to prove. |
| New states, renamed states, LoopStateId changes, a state split | backlog US-12 | No state needs a second signal. A split is only forced when one state must flip signals. |
| Context fields, snapshot fields, persistence changes | none | US-01 stores nothing at runtime. |
| package.json or lockfile changes | none | effect is already a direct dependency; no new package is installed. |
| Changes to state-machine.ts, policy.ts, snapshot.ts, memory.ts, inbox.ts | none | The declarations are inert data, not a runtime feature. |

## Definition of done

The three new tests and the existing suite pass under just opencode::typecheck, just opencode::lint and just opencode::test. No test asserts a new runtime behaviour, because there is none. The reviewable diff is the type, the five blocks, and the tests.

## How to demo

Proof mode: unit only. US-01 changes no runtime behaviour, so a live agent run proves nothing about it.

Run: just opencode::test -- plugins/tests/state-machine/signals.test.ts
Expect: 12 passed. The tests pin the five declarations, the empty blocks on check and parked, the four decoding bounds, the nonblank describe, and the type-only module.

Sensitivity check, one mutation at a time, revert after each:
1. Blank SET_GOAL.describe -> 'gives every declared signal a nonblank describe' fails.
2. Add schema: Schema.Struct({}) to CLAIM_WORK -> 'carries no schema on payloadless signals' fails.
3. Replace the SET_GOAL schema with Schema.String -> the trim and blank tests fail.

Typecheck: just opencode::typecheck -> exit 0.

Does not prove: that any arm uses the declaration, that the tool boundary validates, or that the agent sees a line. Those are US-02, US-04 and US-06.

## References

- core/machine.ts TOOL_SIGNALS
- core/machine.ts SESSION_LOOP
- core/machine.ts toStateConfig and statesFor
- core/machine.ts acceptedTransitions
- .opencode/plugins/state-machine/CONTRACT.md section 4
- .opencode/plugins/state-machine/SIGNALS-CONTRACT.md section 2

## Note on slicing

The story is intentionally inert. Merging it into US-02 is possible, but then a schema-authoring mistake and a validation bug arrive in one review. Keeping it separate also gives US-04 a stable target.