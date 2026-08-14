# Audit Workflow

Answer each question below by extracting data from the session export JSON using the schema reference at `../references/schema.md`. Never read the entire session file — use targeted jq lookups.

For Q1, Q2, Q4, Q6, and Q7, prefer the CLI as the first pass: `just agent_utils/session-parts --session-file-json <session.json> conversation --format short-human-readable` renders the compact transcript, and `just agent_utils/session-parts --session-file-json <session.json> parts --tool-id <callID>` pulls detailed tool evidence. Keep jq for Q8 (agent identity), Q9 (token/cost distribution), timings, and anything the CLI's 200-char truncation hides.

## Questions

- **Q1:** What was the objective of the session? *(jq: first user message text parts excluding `<steering>`)*
  CLI: visible in the transcript as the first user text message (200-char excerpt).
- **Q2:** Has the objective been achieved (not achieved, partially, fully)? *(jq: last assistant message, check if task completed)*
  CLI: visible in the transcript as the last assistant message (200-char excerpt).
- **Q3:** If not achieved, what were the blockers (perform root cause analysis with 5 Whys, make it at least 2 times independently, to make sure the root cause is correctly identified)? *(qualitative — not from JSON)*
- **Q4:** What skills were loaded during the session? *(jq: parts where .type == "tool" and tool name is "skill")*
  CLI: visible in the transcript as `tool skill called <callID>` lines.
- **Q5:** What instructions (`<steering/>`) were sent to the session? *(jq: text parts in user messages that start with `<steering>`)*
- **Q6:** What tools were called during the session (what succeeded, what had errors)? *(jq: parts where .type == "tool" → .tool, .state.status)*
  CLI: visible in the transcript as `tool <name> called <callID>` lines with `output_length` or error status.
- **Q7:** What errors were encountered during the session? *(jq: parts where .type == "tool" and .state.status == "error")*
  CLI: visible in the transcript as `tool <name> called <callID>, error: ...` lines.
- **Q8:** What agent was used during the session? *(jq: .info.agent)*
- **Q9:** How was token consumption distributed (system instructions, user messages, tool calls, etc.)? *(jq: .info.tokens)*

After answering all questions, map findings to improvement patterns using the [harness-management improvement-patterns](../../harness-management/references/improvement-patterns.md) reference and populate `../templates/review-document.md`.

Before implementing any fix (deciding where the change belongs), load the [harness-management](../../harness-management/SKILL.md) skill and follow its Change Type Reference table + the matching workflow (scoped instructions / skill / directory AGENTS.md / agent definition).
