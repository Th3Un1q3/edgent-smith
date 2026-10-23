---
name: live-verification
description: "Canonical definition of a unit test versus a live check: unit tests are hermetic and free of environment-variable gates and skips; a live check is a delegated CLI/agent run with a real agent and model, never a test file. Load when adding, reviewing, or reporting tests and harness verification."
applyTo: "{.opencode/plugins/**/*,.opencode/instructions/**/*.md,.agents/skills/**/*.md,.dsh/**,scripts/conductor/**,AGENTS.md,docs/plan/**/*.md,tests/*.py}"
excludeAgents: "rug"
---

# Live Verification — Canonical Definition

## Unit test

A unit test is deterministic, hermetic and self-contained: no running OpenCode service, no network, no model call, no environment-variable gate, no skip. Stubs, fixtures and temp directories only. Anything that needs infrastructure is not a unit test and must not live in the unit suite.

## Live check

A live check is a delegated CLI/agent run with a real agent and model. It is not a test file of any kind: it is never collected, and it must not be added to `.opencode/plugins/tests/`. There is no live test file type in this repo; do not create a `*.live.test.ts` file or an environment-gated suite. Run a live check by:

1. Delegate a subagent that runs a standalone CLI prompt with a designated agent and model — for example `opencode run --format json --standalone --agent <agent> "<prompt>"` — then reads and interprets the output.
2. When the change affects the current agent, inspecting whether the injected instructions actually appear in your own context — present means working, absent means likely not.
3. Asking a subagent to perform the action that should trigger the instructions and report whether it saw the consequence.
4. For injection probes, placing a fresh random token in the instruction payload and asking the model to echo it in its reply.

## Reporting

Name the command, agent and model, and quote the observed output. An unrun check records nothing and closes no gate. Live evidence is PLAUSIBLE until a real round-trip is quoted.

## Placement

The unit suite (`.opencode/plugins/tests/`) holds unit tests only. A live check leaves no file there and adds no environment-variable gate anywhere.
