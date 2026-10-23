---
id: skills/general/live-verification-definition
type: experiences
L0: "Unit tests are deterministic and hermetic: no server, network, model, env-var gate or skip. A live check is a delegated CLI/agent run, not a test file of any kind — never a vitest case, never collected, never in .opencode/plugins/tests/."
hotness: 0.8
ttl: 180d
version: 2
freshness: 2026-10-22
directory: skills/general
provenance: .opencode/instructions/live-verification.instructions.md (canonical procedure)
---

# Live Verification — Definition

Authoritative procedure: `.opencode/instructions/live-verification.instructions.md`.

## Unit test

A unit test is deterministic, hermetic and self-contained: no running OpenCode service, no network, no model call, no environment-variable gate, no skip. Stubs, fixtures and temporary directories only. A case that needs infrastructure is not a unit test and does not belong in the unit suite at `.opencode/plugins/tests/`.

## Live check

A live check is a delegated CLI/agent run with a real agent and model. It is not a test file of any kind: never a vitest case, never a skipped suite, never collected by any test runner, and never added to `.opencode/plugins/tests/`. This repo has no live test file type, so no `*.live.test.ts` and no environment-gated suite.

Run one by:

1. Delegating a standalone CLI prompt to a subagent with a designated agent and model, then reading and interpreting the output.
2. Inspecting your own context when the change affects the current agent: injected instructions present means working, absent means likely not.
3. Asking a subagent to perform the action that should trigger the instruction and report whether it saw the consequence.
4. Placing a fresh random token in the instruction payload for an injection probe and asking the model to echo it in its reply.

## Reporting

Name the command, agent and model, and quote the observed output. An unrun check records nothing and closes no gate. Live evidence is PLAUSIBLE until a real round-trip is quoted.