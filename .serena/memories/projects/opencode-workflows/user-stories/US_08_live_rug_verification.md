---
id: projects/opencode-workflows/user-stories/US_08_live_rug_verification
L0: "US-08 Should: live rug run proves a refused signal then an accepted one in the same turn; quote command, agent, model, log lines"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: SIGNALS-CONTRACT.md section 11; live-verification.instructions.md
---
# US-08 — Live verification

Priority: Should
Slice: 2
Contract: SIGNALS-CONTRACT.md section 11
Depends on: US_02, US_06
Status: implemented 2026-11-17; three-step live sequence quoted

## Story

As the release owner, I want a real rug session to show a refused signal followed by an accepted one, so the unit fakes are not the only evidence.

## Requirements

R1. Run one standalone session with an authenticated route:
opencode run --format json --standalone --agent rug --model <provider/model> --print-logs 'Call tools.signal_send with type CLAIM_WORK. Quote the error verbatim. Then call tools.signal_send with type SET_GOAL and payload {"goal":"report the first line of AGENTS.md"}. Then reply exactly DONE.' 2>&1
R2. Capture the [state-machine] execute.before lines and the tool error and success.
R3. The refusal must carry code unavailable_signal, list SET_GOAL, and leave the state in define_goal.
R4. The SET_GOAL call must move the state to work and must not enter panic.
R5. Quote the command, agent, model and the observed lines in the delivery summary.
R6. If provider authentication fails, record the exact error and mark the check unrun; never record a pass.
R7. Add no test file, no environment-variable gate and no skip to the unit suite.

## Acceptance criteria

AC1. Given the live run output, then a refusal line names CLAIM_WORK and SET_GOAL.
AC2. Given the live run output, then SET_GOAL returns Signal accepted. and the following CLAIM_WORK is accepted.
AC3. Given the summary, then it quotes the command, agent, model and both lines.
AC4. Given an auth failure, then the summary quotes the failure and says the check did not run.
AC5. Given the repository, when tests are listed, then no new live test file exists.

## How to demo

This story is the live proof; unit gates are preconditions, not the demo.

Precondition: just opencode::test -- --coverage passes.

Run: opencode run --format json --standalone --agent rug --model <authenticated-route> --print-logs "Call tools.signal_send with type CLAIM_WORK. Quote the error verbatim. Then call tools.signal_send with type SET_GOAL and payload {"goal":"report the first line of AGENTS.md"}. Then reply exactly DONE." 2>&1

Expect: a refusal line naming CLAIM_WORK and SET_GOAL; SET_GOAL returning 'Signal accepted.'; the following CLAIM_WORK accepted; the three execute.before log lines.

Observed 2026-11-17 with opencode-go/deepseek-v4.1-flash, agent rug. Refusal run: CLAIM_WORK status error with 'CLAIM_WORK is not available in define_goal.' and the SET_GOAL line; then SET_GOAL and CLAIM_WORK both returned 'Signal accepted.'. Full-loop run: CLAIM_WORK, GOAL_ACHIEVED and LESSON each returned 'Signal accepted.', the final reply was DONE, and the log contained no 'Agent not found: validator' or 'Failed to drain Session'. execute.before lines show signal_send for each call. The validate state now prompts the loop agent for its verdict instead of dispatching a validator child; the dispatch capability remains dormant.

Evidence to attach: command, agent, model, and the two quoted lines.
On provider auth failure: quote the error and mark the run unrun. Do not generalize.

Does not prove: any route that was not used, or host behaviour beyond the one session.

## References

- .opencode/instructions/live-verification.instructions.md Plugin hook or prompt-path changes
- .opencode/plugins/state-machine/SIGNALS-CONTRACT.md section 11
- .opencode/plugins/tests/state-machine.test.ts unit coverage only

## Out of scope

No unit test masquerading as live evidence. No model route change in the repository config.