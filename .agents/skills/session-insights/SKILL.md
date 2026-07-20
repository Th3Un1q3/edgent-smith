---
name: session-insights
description: >
  Extract analytical insights from exported OpenCode session JSON files — skills used, instructions shown, lineage tracing,
  and metadata analysis. Use when you want to understand what happened during a session (which skills loaded, which
  instructions were displayed, whether they were followed) rather than auditing tool call errors or parsing message parts.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  author: edgent-smith team
---

# Session Insights Skill

Analyse exported OpenCode session JSON files: skills loaded, instructions shown, lineage tracing, and metadata analysis. Use for post-session insight extraction — not tool-call error auditing (use `session-audit` instead).

## Directory Layout

| Path | Purpose |
|---|---|
| `workflows/` | `session-audit.md` — step-by-step extraction workflow |
| `references/` | `schema.md` (SessionStorage fields), `extending_scripts.md` (how to add scripts) |

## Principles

- NEVER read entire session files (they're gigantic), use schema-based lookups to extract only the fields you need.

## Task Routing Table

| I want to... | File |
|---|---|
| Perform session audit | [workflows/session-audit.md](./workflows/session-audit.md) |
| Use session schema to lookup session fields (such as messages, reasoning, tool calls) | [references/schema.md](./references/schema.md) |
| Figure out types of improvements that can be made | [references/agentic_system.md](./references/agentic-system.md) |
