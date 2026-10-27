---
name: execute-logging-and-goal-reachability
description: console.log inside an execute body reaches the caller under Logs: and survives a throw, so a parallel trace array is redundant; rug.md moved 27 trace.push sites to console.log; a code-mode-only goal tool deadlocks a pre-goal gate that rejects execute.
scope: claims
status: active
confidence: high
timestamp: 2026-10-25
tags: [execute, code-mode, logging, goal, rug-agent, gate]
sources:
  - session 2026-10-25 — rug agent execution-envelope change, fresh validation run, just verify-agents + markdownlint
---

# execute logging and goal reachability

## 1. console.log is a returned progress channel, not a debug sink

console.log inside an execute body is returned to the caller under a Logs: section, and it survives a throw: a body that logs then throws returns Uncaught: {...} followed by Logs: and the printed line. Consequence: console lines are a reliable progress channel on both the success and failure paths, and a parallel trace array that duplicates them is redundant state. Source: observed execute return in the 2026-10-25 session.

## 2. rug.md execution envelope changed to match

.opencode/agents/rug.md converted 27 trace.push sites to console.log, deleted the trace array, made the success path return result, and made the catch rethrow { audit, error }. Fresh validation passed, and just verify-agents plus markdownlint passed. Source: applied edit and those gate runs, 2026-10-25.

## 3. Code-mode-only goal plus a pre-goal gate that rejects execute is a deadlock

When the goal tool is reachable only inside code mode while the goal-first gate rejects the execute tool, agent rug cannot arm a session at all: no direct goal tool means no path to set the goal, and the gate blocks the only surface that has one. Working configurations are either a direct goal surface for the agent or an execute exemption from the pre-goal gate. The owner added the exemption, after which tools.goal inside execute returned ok. Source: observed denial loop then successful tools.goal call, 2026-10-25.

## Why this is durable

It removes a duplicated log channel and names a configuration rule: keep a goal surface reachable from whatever tool the pre-goal gate permits.