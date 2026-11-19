---
id: projects/opencode-workflows/user-stories/epic_signal_validation
L0: "Signal validation epic: per-state declarations, Effect Schema validation, Tool.Error refusals, generated availability line; two slices"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: design session 2026-11-17; SIGNALS-CONTRACT.md
---
# Epic — Declarative signal validation

Priority: Must for Slice 1, Should for Slice 2
Contract: .opencode/plugins/state-machine/SIGNALS-CONTRACT.md
Scope: agent_sent_signal events arriving through signal_send; callbacks and system events are out of scope.

## Goal

One declaration per state: the signals it accepts, the payload shape each expects, and the instruction the agent reads. Validation, availability text and refusals derive from it.

## MoSCoW

Must, Slice 1: US_01 declaration model, US_02 boundary validation and refusals, US_03 nested payload event, US_04 load-time invariants, US_05 open tool payload.
Should, Slice 2: US_06 generated availability line, US_07 contract and docs, US_08 live verification.
Could, backlog: US_09 YAML ingestion, US_10 derived vocabulary, US_11 metadata consumers.
Won't this iteration: gate prose removal, dynamic tool schema, phases or substates, AJV, tolerating extra keys on schema'd signals.

## Decisions that bind every story

- Availability is static per state; a flip is a state split.
- The signals block is per state, declarations inline in SESSION_LOOP.
- The payload schema is authoritative for the signal in that state.
- Effect Schema is the validator and authoring format now; JSON Schema arrives with the YAML stage through fromJsonSchemaDocument.
- A payloadless signal has no schema; its payload is accepted and dropped.
- Events carry a nested payload, not flattened fields.
- Refusals are Tool.Error with message and metadata, sharing an envelope with the tool gate.
- TOOL_SIGNALS stays hand-written this iteration.
- An invariant violation throws at module load.
- core/signals.ts holds the machinery; declarations stay in machine.ts.

## Progress

- US-01 implemented 2026-11-17: declarations and schema bounds.
- US-03 implemented 2026-11-17: nested payload event; five payload tests, and the top-level-read mutation failed four of them.
- US-02 implemented 2026-11-17: validateSignal, refusal messages and metadata, Tool.Error mapping; live refusal then acceptance observed with opencode-go/deepseek-v4.1-flash.
- US-04 implemented 2026-11-17: assertSignalDeclarations runs on createStateMachine; eight invariant tests.
- US-05 implemented 2026-11-17: signal_send payload opened; registration test.
- US-06 implemented 2026-11-17: display_signals action, emit.signals, separate synthetic, idle reuses it.
- US-07 implemented 2026-11-17: CONTRACT.md folded, gate metadata added, SIGNALS-CONTRACT reduced to a pointer.
- US-08 implemented 2026-11-17: three-step live sequence quoted.
- All eight stories implemented.
- Live finding and refinement 2026-11-17: validate dispatched to a missing validator agent and the session drain failed. startValidator gained an existence check and fallback; then the loop was simplified to prompt the loop agent for its verdict, so no validator child is created. Full loop observed: SET_GOAL -> CLAIM_WORK -> GOAL_ACHIEVED -> LESSON -> DONE.

## How to demo (conventions)

- Unit: hermetic, run with just opencode::test -- <file>. Proves the module, not the host.
- Registered-tool: drives signal_send through the test harness. Proves the plugin path, not the host.
- Live: opencode run --standalone --agent rug --print-logs. The only proof of host behavior.
- Inspection: grep, read, typecheck. No runtime claim.
- A live check that fails authentication is unrun, never pass. Quote the command, agent, model and observed lines.
- Every story names its proof mode and what it does not prove.

## Evidence base

Symbols, not lines: core/machine.ts (TOOL_SIGNALS, LoopContext, RecordSource, RecordParameters, ActionSpec, GuardSpec, SignalRequest, LoopEvent, SESSION_LOOP, acceptedTransitions, readEvent, readSource, applyRecord, GOAL_REQUIRED_MESSAGE, parseSignal, signal, status), core/signals.ts (SignalSpec), state-machine.ts (signalInput, PROMPT_DESCRIPTION, deliver, tool execute), tests/state-machine.test.ts signal assertions. Story references carry design-time line numbers; resolve the symbol in the current tree before editing.

## Delivery

Slice 1 lands US_01 through US_05. Slice 2 lands US_06 through US_08. Each story is reviewable alone and test-first: failing test, then the smallest implementation, then the gates just opencode::typecheck, just opencode::lint, just opencode::test.