---
id: projects/opencode-workflows/workflow-tool/orchestration-patterns
type: entities
L0: "Six subtask_run patterns — chain, fork fan-out, map-reduce, structured classification, branch, retry loop — sequenced by the caller; nothing in the plugin fans out or queues, and every call costs one child session"
freshness: 2026-11-24
directory: projects/opencode-workflows/workflow-tool
ttl: 180d
provenance: docs/workflow-tool.md — section Orchestration patterns (### Orchestration patterns, lines 111-122)
---
# Orchestration patterns

Each `subtask_run` call runs one child and returns one result. The caller sequences the calls; nothing in the plugin fans out or queues them.

- **Chain:** pass the previous result's `outputText` into the next prompt, and its `task_id` when the next step should continue the same child conversation instead of starting fresh.
- **Fork fan-out:** one call reads the source document and returns its `task_id`. Later calls pass that id as `fork_from`, so every fork starts from the same document, and a final call synthesizes the answers. Each fork copies the source history, so N forks multiply the tokens the source document costs; the caller reuses one fork id through `task_id` when follow-up turns should keep that fork's context.
- **Map-reduce:** run one call per independent item, then one final call that merges the outputs.
- **Structured classification:** run one schema call per item, then reduce over `data` by field. When the merge needs only each child's prose, skip the schema and read `outputText`.
- **Branch:** when `data` drives the decision, the next call follows the branch the field selects; no text parser is needed.
- **Retry loop:** failures are values, so the caller reissues the call with the same `task_id` or a corrected prompt until `status` is `ok`.

Cost line: every call costs one child session, including retries and calls that end `aborted`. The dispatch author counts calls, not unique children, when sizing a run.