---
name: session-insights
description: >
  Extract analytical insights from exported OpenCode session JSON files — skills used, instructions shown, lineage tracing,
  metadata analysis, and tool-call error auditing. Use when you want to understand what happened during a session (which
  skills loaded, which instructions were displayed, whether they were followed) or audit tool-call errors — both are covered
  by the `workflows/session-audit.md` workflow.
license: MIT
compatibility: Universal
metadata:
  version: "1.3.0"
  delta: "Restructured session_parts.py CLI to Click (conversation/parts/info/summary flows); migrated extending_scripts.md, SKILL.md routing, session-analysis command, session-audit workflow, and agent_utils justfile."
  author: edgent-smith team
---

# Session Insights Skill

Analyse exported OpenCode session JSON files: the skills loaded, instructions shown, lineage tracing, metadata analysis, and tool-call error auditing. Use for post-session insight extraction AND tool-call error auditing — both are covered by the `workflows/session-audit.md` workflow (its Q6/Q7 audit tool calls and errors).

## Directory Layout

| Path | Purpose |
|---|---|
| `workflows/` | `session-audit.md` — step-by-step extraction workflow |
| `references/` | `schema.md` (SessionStorage fields), `extending_scripts.md` (CLI usage & how to add scripts) |
| `scripts/` | `session_parts.py` — Click CLI: conversation/parts/info/summary flows |
| `tests/` | `test_session_parts.py` + `fixtures/session.json` — CLI suite with real-session fixture |

## Principles

- NEVER read entire session files (they're gigantic), use schema-based lookups to extract only the fields you need.
- When suggesting how to ADDRESS an identified issue, defer to the `harness-management` skill — load it and follow its Change Type Reference + workflows; do not prescribe implementations here.
- Use `just agent_utils/session-parts` utility as described in `references/extending_scripts.md` to get quick access to the contents of the session. Only if it has no relevant helper, learn [schema](./references/schema.md) and explore raw session.json via jq.

## Task Routing Table

| I want to... | File |
|---|---|
| Perform session audit | [workflows/session-audit.md](./workflows/session-audit.md) |
| Use session schema to lookup session fields (such as messages, reasoning, tool calls) | [references/schema.md](./references/schema.md) |
| Render a session conversation or extract parts via the CLI | [references/extending_scripts.md](./references/extending_scripts.md) — script: `scripts/session_parts.py` |
| Figure out types of improvements that can be made | Load the `harness-management` skill by name (your `skill` tool); its `references/improvement-patterns.md` lists P1–P4 |
| Create a session review document | [templates/review-document.md](./templates/review-document.md) |
| Produce improvement recommendations | Load the `harness-management` skill by name (your `skill` tool); its `references/improvement-patterns.md` lists P1–P4 |
| Decide where a suggested improvement belongs and implement it (address identified issues) | Load the `harness-management` skill by name (your `skill` tool); follow its Change Type Reference + workflows |
