# Copilot Instructions – edgent-smith

This repository implements a minimal, edge-optimised agentic system.

## Three-agent architecture

| Agent | File | Role |
|---|---|---|
| Edge Agent | `agents/edge.py` | pydantic-ai agent; inline tools; orchestrates workflow |
| Brainstorm Agent | `agents/brainstorm.py` | Copilot custom agent; generates ideas; creates GitHub issues |
| Implementation Agent | `agents/implement.py` | Copilot custom agent; implements experiments; creates PRs |

## Before making any change

1. Check that your change is within the allowed mutation surface (see the active issue).
2. Run `pytest tests/ -q` to confirm tests pass.
3. Run `ruff check agents/ evals/ tests/` to confirm lint passes.

## Mutation boundaries

- **Allowed during experiments**: `agents/edge.py` (system prompt, tools), `evals/smoke.py`.
- **Never change**: CI workflows, devcontainer, `tests/`, this file.

## Prompts

All agent and workflow prompts live in `.github/prompts/*.prompt.md`.

## Python runtime

Target Python 3.13. Do not add `from __future__ import annotations` or compatibility shims.

## Dependencies

Use only `pydantic-ai[evals]` and `httpx`. Do not add new dependencies without approval.
