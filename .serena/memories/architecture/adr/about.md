---
type: architecture
L0: "ADR index — architecture decision records"
L0_table: ["architecture/adr/ADR-018-run-skill-evaluations-via-opencode: Run skill evaluations via an OpenCode command", "architecture/adr/ADR-019-skill-eval-conductor-pipeline: Skill evaluations run as a conductor pipeline", "architecture/adr/ADR-020-serving-opencode-web-locally-with-tunneling: Serving the opencode web UI locally with tunneling", "architecture/adr/ADR-022-append-only-steering-message-injection: Append-only synthetic steering messages for file-visit instruction injection", "architecture/adr/ADR-023-subtask-outputs-session-message-source: subtask_outputs reads child session messages; subtask_tail removed", "architecture/adr/ADR-024-labelled-subagent-sessions: Labelled subagent sessions bind a label to one child session id"]
---

# ADR Index

Index of architecture decision records under `architecture/adr/`. See `mem:architecture/adr/ADR-018-run-skill-evaluations-via-opencode` (superseded by ADR-019) and `mem:architecture/adr/ADR-019-skill-eval-conductor-pipeline`. `mem:architecture/adr/ADR-023-subtask-outputs-session-message-source` replaces the `subtask_tail` retrieval path with `subtask_outputs`, superseding the trio clause of `mem:architecture/adr/ADR-012-standalone-subtask-trio`. `mem:architecture/adr/ADR-024-labelled-subagent-sessions` adds session-scoped labels to `subtask_run`, binding one label to one child for the session's life.
