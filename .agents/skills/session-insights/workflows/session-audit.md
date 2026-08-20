# Audit Workflow
Each question below names the one place to look for its answer:

- `transcript.txt` — what was said during the session.
- `just agent_utils/session-parts` — the session-parts command: `parts` for tool-call detail, `info` for session stats, `summary` for aggregations.
- jq — only for the ad-hoc crossing-step question; everything else uses the command or the filled sections.
- review.md §3–§7 — `review-start` already filled them; read the filled sections, do not recompute.

Never read the entire session file; use targeted lookups via the schema reference at `../references/schema.md`.

`transcript.txt` always exists after `review-start` renders it. If it contains the literal note "Error: transcript render failed", re-render it with `just agent_utils/session-parts --session-file-json <session.json> conversation --format short-human-readable` before the first pass.

## Questions

- **Q1:** What was the objective of the session? *(transcript.txt: first user text message, excluding `<steering>`)*
- **Q2:** Has the objective been achieved (not achieved, partially, fully)? *(transcript.txt: last assistant message)*
- **Q3:** If not achieved, what were the blockers (find the root cause with 5 Whys, run it at least twice independently to confirm)? *(transcript.txt: qualitative narrative — not recomputed from JSON)*
- **Q4:** What skills were loaded during the session? *(read review.md §3 — pre-filled by `summary`. "Loaded" = native `skill` tool calls plus delegated `<skill>` tags inside `<task_skills>` payloads; bare prose tags do not count; no jq)*
- **Q5:** What instructions (`<steering/>`) were sent to the session? *(read review.md §4 — pre-filled by `summary`)*
- **Q6:** What tools were called during the session (what succeeded, what had errors)? *(read review.md §5 — pre-filled by `summary`)*
- **Q7:** What errors were encountered during the session? *(read review.md §6 — pre-filled by `summary`)*
- **Q8:** How was token consumption distributed (system instructions, user messages, tool calls, etc.)? *(read review.md §7 — do not recompute)*

After answering all questions, map findings to improvement patterns — load the `harness-management` skill by name with your `skill` tool and use its `references/improvement-patterns.md` (P1–P4) — then populate `../templates/review-document.md`.

Before implementing any fix (deciding where the change belongs), load the `harness-management` skill by name with your `skill` tool and follow its Change Type Reference table + the matching workflow (scoped instructions / skill / directory AGENTS.md / agent definition).
