---
name: session-insights
description: >
  Extract analytical insights from exported OpenCode session JSON files — skills used, instructions shown, lineage tracing,
  and metadata analysis. Use when you want to understand what happened during a session (which skills loaded, which
  instructions were displayed, whether they were followed) rather than auditing tool call errors or parsing message parts.
license: MIT
compatibility: Universal
metadata:
  version: "1.3.0"
  delta: "Restructured session_parts.py CLI to Click (conversation/parts flows); migrated extending_scripts.md, SKILL.md routing, session-analysis command, session-audit workflow, and agent_utils justfile."
  author: edgent-smith team
---

# Session Insights Skill

Analyse exported OpenCode session JSON files: skills loaded, instructions shown, lineage tracing, and metadata analysis. Use for post-session insight extraction — not tool-call error auditing (use `session-audit` instead).

## Directory Layout

| Path | Purpose |
|---|---|
| `workflows/` | `session-audit.md` — step-by-step extraction workflow |
| `references/` | `schema.md` (SessionStorage fields), `extending_scripts.md` (CLI usage & how to add scripts) |
| `scripts/` | `session_parts.py` — Click CLI: conversation/parts session parts |
| `tests/` | `test_session_parts.py` + `fixtures/session.json` — CLI suite with real-session fixture |

## Principles

- NEVER read entire session files (they're gigantic), use schema-based lookups to extract only the fields you need.
- Use the `session-analysis` command (`/session-analysis {sessionid}`) to automate the full audit + improvement pipeline; when it suggests ADDRESSING an issue, it routes through `harness-management` (the pipeline does not implement fixes itself).
- When suggesting how to ADDRESS an identified issue, defer to the `harness-management` skill — load it and follow its Change Type Reference + workflows; do not prescribe implementations here.
- Prefer the `session_parts.py` CLI over hand-rolled jq for mechanical extraction/formatting when it covers the need (see `references/extending_scripts.md`).

## Task Routing Table

| I want to... | File |
|---|---|
| Perform session audit | [workflows/session-audit.md](./workflows/session-audit.md) |
| Use session schema to lookup session fields (such as messages, reasoning, tool calls) | [references/schema.md](./references/schema.md) |
| Render a session conversation or extract parts via the CLI | [references/extending_scripts.md](./references/extending_scripts.md) — script: `scripts/session_parts.py` |
| Figure out types of improvements that can be made | [harness-management improvement-patterns](../harness-management/references/improvement-patterns.md) |
| Create a session review document | [templates/review-document.md](./templates/review-document.md) |
| Produce improvement recommendations | [harness-management improvement-patterns](../harness-management/references/improvement-patterns.md) |
| Decide where a suggested improvement belongs and implement it (address identified issues) | [harness-management](../harness-management/SKILL.md) (load it; follow its Change Type Reference + workflows) |
