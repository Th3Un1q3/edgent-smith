---
id: projects/opencode-workflows/user-stories/US_06_display_signals_action
L0: "US-06 Should: explicit display_signals action with optional signal_keys; separate synthetic; idle reuses it; undeclared keys omitted"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: design review 2026-11-17; SIGNALS-CONTRACT.md section 6
---
# US-06 — Explicit signal display

Priority: Should
Slice: 2
Contract: SIGNALS-CONTRACT.md section 6
Depends on: US-01, US-02, US-04
Status: implemented 2026-11-17 (Slice 2); renderer, action, delivery and tests

## Story

As the loop maintainer, I want a display_signals action I can place on entry, optionally restricted to named signals, so that advertising is explicit, derived from the state's declaration, and independent of prompt prose.

## Requirements

R1. renderSignals(signals, signal_keys?) renders the declared signals of a state. Without keys it uses every declared signal in declaration order. With keys it uses only keys the state declares, in the given order, and a duplicate renders once. An empty selection or a state with no declared signals renders 'Signals now: none'. Undeclared keys are omitted silently; they are neither rendered nor an error.

R2. Action shape: { type: 'display_signals', params: { signal_keys?: readonly ToolSignal[] } }. params is required for consistency with every other action; signal_keys is optional.

R3. The action emits { type: 'emit.signals', signal_keys? }. The actor does not render; it carries the selection.

R4. The plugin delivers emit.signals as its own synthetic prompt. It resolves the current state, calls renderSignals(stateSignals, signal_keys), and sends it with the fixed description 'The session loop is listing the signals this state accepts.'

R5. Initial placement: define_goal entry, work entry, memorize entry, panic entry. validate, check and parked are not given the action, although it is allowed there and renders 'Signals now: none'.

R6. Remove the signal clauses from goal_request, work_towards_goal, memorize and panic_escalation. Keep their context prose. validation_self_report is untouched.

R7. Idle follow-up: each idle arm emits state_follow_up and then display_signals; followUpText no longer calls renderSignals.

R8. Delete memory_required, its renderer and the two fallback arms in memorize and panic.

R9. No automatic append anywhere. A state without the action advertises nothing beyond refusals.

R10. assertSignalDeclarations is unchanged. signal_keys is not load-validated; the renderer filters. A typo renders as an omission.

## Acceptance criteria

AC1. define_goal entry emits emit.signals with no keys; the delivered text contains '- SET_GOAL — State the goal this session must accomplish, in payload.goal.'
AC2. work advertises only CLAIM_WORK; memorize and panic advertise only LESSON.
AC3. signal_keys ['SET_GOAL'] in a state declaring SET_GOAL and CLAIM_WORK renders only SET_GOAL.
AC4. signal_keys ['CLAIM_WORK'] in define_goal renders 'Signals now: none'; it does not throw.
AC5. signal_keys [] renders 'Signals now: none'.
AC6. signal_keys ['SET_GOAL', 'SET_GOAL'] renders SET_GOAL once.
AC7. display_signals in check or parked renders 'Signals now: none'.
AC8. No template contains 'Send CLAIM_WORK' or 'call signal_send with type SET_GOAL'; the synthetic carries that information.
AC9. A blank LESSON is refused by schema; memory_required does not exist.
AC10. Idle follow-up text no longer contains the list; the idle arm emits display_signals instead.

## How to demo

- Renderer unit: all declared, subset, undeclared key omitted, empty array, duplicate, zero-signal state.
- Action unit: a machine started in define_goal; machine.wake() contains { type: 'emit.signals' }; with keys the emit carries them.
- Registered tool: open a session and read the synthetic prompts; the signals message is separate from the goal request.
- Live: after SET_GOAL, the work entry delivers the signals prompt, then the agent sends CLAIM_WORK without a refusal. Quote the execute.before lines; quote the prompt only if the log exposes it.

Observed 2026-11-17 with opencode-go/deepseek-v4.1-flash, agent rug: SET_GOAL and CLAIM_WORK both returned 'Signal accepted.' in one Code Mode block. The separate signals prompt is asserted by the unit suite; the live log does not print prompt text.
- Does not prove: that the model reads the list; an undeclared key was a mistake, because omission is silent by design.

## Out of scope

- validate and validator routing.
- Load-time validation or warning for signal_keys.
- UI or CLI for editing visibility.
- Persisting visible signals; the action runs per entry.
- Per-turn context hooks.

## Review decisions

- Action shape: params object.
- Undeclared keys: omitted silently; no load check.
- Delivery: separate synthetic.
- Idle follow-up: uses the action.
- Placement: define_goal, work, memorize, panic.
- Zero-signal states: allowed; render none.