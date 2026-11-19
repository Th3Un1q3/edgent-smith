---
id: conventions/synthetic-prompt-description
type: claims
L0: "Every context.session.synthetic call in .opencode/plugins/state-machine.ts passes a user-visible description sentence, so the person sees what the loop is doing."
hotness: 0.6
ttl: 180d
version: 1
freshness: 2026-11-16
directory: conventions
provenance: .opencode/plugins/state-machine.ts:141-146,207-220; .opencode/node_modules/@opencode/client/dist/effect/api/api.d.ts:348; .opencode/plugins/tests/helpers/state-machine-harness.ts:36-42,189
---

# Synthetic prompts carry a user-visible description

Every synthetic prompt the plugin emits goes through one helper, `sendPrompt(sessionId, text, description)`, which forwards `description` into `context.session.synthetic({ sessionID, text, description, resume: true })` (`.opencode/plugins/state-machine.ts:141-146`). The description is a plain sentence saying what the loop is doing, so the person sees the purpose of an injected message instead of an unexplained prompt.

## Distinct sentences per prompt kind

`PROMPT_DESCRIPTION` maps each state to its own sentence (`state-machine.ts:207-215`): `define_goal` asks for the goal to work towards; `work` asks the agent to keep working toward the recorded goal; `check` reports the quality check result; `validate` asks a validator session for its verdict; `memorize` asks for a lesson to remember; `parked` waits for the next instruction; `panic` says the loop stopped after a failure. `promptDescription(state)` returns that sentence and, for a session with no recorded state, the generic "The session loop is prompting the agent about the session." (`:217-220`). The record is typed as `Readonly<Record<NonNullable<ReturnType<typeof machine.state>>, string>>`, so a new state with no sentence fails to compile and no prompt kind can ship undescribed. Both prompt emit paths pass `promptDescription(machine.state(sessionId))` (`:228,234`).

## The client type declares the optional field

`SessionSyntheticInput` in the installed client declares `description?: string | undefined` beside `text` (`.opencode/node_modules/@opencode/client/dist/effect/api/api.d.ts:348`). The field is optional at the type level, so nothing forces a caller to pass it; the convention is enforced by the plugin, not by the type.

## The test double must mirror the field

The test double in `.opencode/plugins/tests/helpers/state-machine-harness.ts` mirrors the client type as `interface SyntheticMessage { sessionID; text; description?: string; resume? }` (`:36-42`, commented "Mirrors SessionSyntheticInput in @opencode/client dist/effect/api/api.d.ts"), and its fake `context.session.synthetic` pushes the whole input onto the captured `synthetics` array (`:189`). A change to the emitted description or to the client type must move in that mirror in the same change, or a test asserting that a prompt carries its sentence expires silently against a stale double.

## Evidence

- Source: `.opencode/plugins/state-machine.ts` — single `context.session.synthetic` call site at line 142, helper at 141, description table at 207-220, callers at 228 and 234 (verified 2026-11-16).
- Source: `.opencode/node_modules/@opencode/client/dist/effect/api/api.d.ts` line 348 declares `readonly description?: string | undefined` on `SessionSyntheticInput` (verified 2026-11-16).
- Source: `.opencode/plugins/tests/helpers/state-machine-harness.ts` — `SyntheticMessage.description` at line 41, capture at line 189 (verified 2026-11-16).