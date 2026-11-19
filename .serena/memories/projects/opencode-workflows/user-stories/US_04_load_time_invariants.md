---
id: projects/opencode-workflows/user-stories/US_04_load_time_invariants
L0: "US-04 Must: assertSignalDeclarations at load; arm/declaration bijection, vocabulary, examples decode, reserved keys, nonblank describe; throw"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: SIGNALS-CONTRACT.md section 7
---
# US-04 — Enforce declaration invariants at load

Priority: Must
Slice: 1
Contract: SIGNALS-CONTRACT.md section 7
Depends on: US-01
Status: implemented 2026-11-17 (Slice 1); eight invariant tests

## Story

As the loop maintainer, I want a declaration that drifts from the transition table to fail the plugin load, so that the agent is never told about a signal the machine cannot handle.

## Requirements

R1. core/signals.ts exports assertSignalDeclarations(loop); it is pure over the loop definition, throws Error on the first violation, and names the state and signal in the message.
R2. Bijection: for every state, the set of agent_sent_signal arm keys equals the set of signals keys. Root-level on is excluded.
R3. Vocabulary: every declared name is in TOOL_SIGNALS, and every TOOL_SIGNALS name is declared by at least one state.
R4. Examples: when a spec carries examples[0], it decodes against that spec's schema with onExcessProperty error.
R5. Reserved keys: no schema declares a top-level property named type or payload.
R6. Describe: every describe is nonblank after trimming.
R7. Payloadless: a spec without a schema carries no example; nothing is checked because there is no schema to annotate.
R8. The machine module calls assertSignalDeclarations once at load, before any actor can be created.

## Acceptance criteria

AC1. Given a synthetic loop with an arm and no declaration, when asserted, then it throws and names the state and signal.
AC2. Given a declaration and no arm, when asserted, then it throws.
AC3. Given a declared name outside TOOL_SIGNALS, when asserted, then it throws.
AC4. Given a TOOL_SIGNALS name declared by no state, when asserted, then it throws.
AC5. Given an example that does not decode, when asserted, then it throws and names the signal.
AC6. Given a schema property named type or payload, when asserted, then it throws.
AC7. Given a blank describe, when asserted, then it throws.
AC8. Given the shipped SESSION_LOOP, when asserted, then it does not throw.

## How to demo

Proof mode: unit with synthetic loops, plus one manual mutation of the real loop.

Run: just opencode::test -- plugins/tests/state-machine/signals.test.ts
Expect: each synthetic violation throws and names the state and signal; the shipped SESSION_LOOP passes.

Mutation demo, revert after:
1. Remove the SET_GOAL entry from define_goal.signals in core/machine.ts.
2. Run the focused state-machine suite; the harness calls createStateMachine during registration.
3. Expect createStateMachine to throw 'define_goal has an arm for SET_GOAL but no declaration' before any machine starts.

Does not prove: runtime refusal behavior (US-02) or payload carrying (US-03).

## References

- .opencode/plugins/state-machine/core/machine.ts:17 TOOL_SIGNALS
- .opencode/plugins/state-machine/core/machine.ts:432 SESSION_LOOP
- .opencode/plugins/state-machine/SIGNALS-CONTRACT.md section 7
- .opencode/plugins/tests/state-machine.test.ts:50 existing load-failure test pattern

## Example failure

thrown: define_goal declares no signal spec for agent_sent_signal.SET_GOAL

## Out of scope

No runtime per-session validation of the loop. No warning mode: a mismatch always throws.