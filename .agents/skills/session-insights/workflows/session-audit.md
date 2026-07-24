# Audit Workflow

Answer each question below by extracting data from the session export JSON using the schema reference at `references/schema.md`. Never read the entire session file — use targeted jq lookups.

## Questions

- **Q1:** What was the objective of the session? *(jq: first user message text parts excluding `<steering>`)*
- **Q2:** Has the objective been achieved (not achieved, partially, fully)? *(jq: last assistant message, check if task completed)*
- **Q3:** If not achieved, what were the blockers (perform root cause analysis with 5 Whys, make it at least 2 times independently, to make sure the root cause is correctly identified)? *(qualitative — not from JSON)*
- **Q4:** What skills were loaded during the session? *(jq: parts where .type == "tool" and tool name is "skill")*
- **Q5:** What instructions (`<steering/>`) were sent to the session? *(jq: text parts in user messages that start with `<steering>`)*
- **Q6:** What tools were called during the session (what succeeded, what had errors)? *(jq: parts where .type == "tool" → .tool, .state.status)*
- **Q7:** What errors were encountered during the session? *(jq: parts where .type == "tool" and .state.status == "error")*
- **Q8:** What agent was used during the session? *(jq: .info.agent)*
- **Q9:** How was token consumption distributed (system instructions, user messages, tool calls, etc.)? *(jq: .info.tokens)*

After answering all questions, map findings to improvement patterns using `references/agentic-system.md` and populate `templates/review-document.md`.
