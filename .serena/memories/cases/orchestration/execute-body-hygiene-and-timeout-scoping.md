---
id: cases/orchestration/execute-body-hygiene-and-timeout-scoping
type: cases
L0: "An empty subtask return at the default timeout is mis-scoped, not incapable: name paths, resume the task_id. A goal outside the dispatch body, a duplicate const, and backticks in a template literal each cost a round before any child ran."
hotness: 0.55
ttl: 180d
version: 1
freshness: 2026-10-29
directory: cases/orchestration
confidence: 0.8
status: active
tags: [task-delegation, subtask-timeout, execute-body, response-schema]
provenance: "Orchestrator run record, 2026-10-29: seven observations from one exploration task that changed no repository file."
claim_ids: []
---

# Idea

One exploration run failed in two independent families, neither a child-model weakness: dispatches the harness rejected, and dispatches with no closeable question.

- **Timeout is a scoping signal.** Listing every skill directory, reading all front matter, reading rug.md, and searching the project expired at the 15-minute default with empty output. Resuming the same task_id at 60 minutes with a prompt naming exactly three paths returned accurate content in about seven minutes (obs 5, 6). A differently broad re-dispatch returned empty again (obs 4).
- **The goal gate reads the goal tool.** Two execute bodies dispatched subtask_run without tools.goal and were rejected; setting it with tools.goal({action:"set"}) in the same body unblocked the dispatch. A goal in a local JS object does not count (obs 1).
- **A parse error costs the whole round.** Two const declarations of one name failed the body before any dispatch; the re-sent body differed only there (obs 2).
- **Quote prompts, do not template them.** Backticks inside a template literal failed with "Unexpected token (48:3)"; a double-quoted string with newline escapes fixed it (obs 3).
- **Schema decides parseability.** The schema-less scouting ask for a JSON array returned empty; the schema-constrained subtask returned clean JSON in result.data while its displayed outputText was clipped (obs 4, 7).

# Scope

Orchestrators building execute bodies that carry subtask_run, and parsing a child reply. Not child prompt content, model choice, or a harness defect: every failure was recoverable in-run with the same tools.

# Rationale

Each rule is checkable before a child spends a call: a goal call in the body, one declaration per name, a quoted string, a response_schema, a named path list, a read of result.data. The timeout rule is a diagnosis, not a value: a larger budget alone would have paid for the same breadth twice; recovery came when the prompt also shrank to three paths.

# Evidence

Source: orchestrator observations 1-7, 2026-10-29. Two default-timeout expiries, one resume at 60 minutes returning ok in about seven minutes, two goal-gate rejections, one duplicate-declaration error, one template-literal token error, one clipped display beside a complete result.data.

# Cross-references

- mem:cases/orchestration/timeout-habit-and-proxy-judging — forbids sizing a dispatch by timeout; this adds that breadth, not budget, is the defect.
- mem:cases/delegation-goal-gate-and-prompt-width — goal gate and prompt width; consistent.
- mem:cases/orchestration/skill-scouting-cadence-counter — an empty scouting reply is a parse failure; reproduced here without a schema.
