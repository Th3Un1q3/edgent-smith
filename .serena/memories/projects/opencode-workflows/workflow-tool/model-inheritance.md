---
id: projects/opencode-workflows/workflow-tool/model-inheritance
type: entities
L0: "A subtask runs on the parent session's model: the runtime takes the first provider and model found scanning parent messages newest to oldest; agent picks the handler, not the model"
freshness: 2026-11-24
directory: projects/opencode-workflows/workflow-tool
ttl: 180d
provenance: docs/workflow-tool.md — section Model inheritance (### Model inheritance, lines 103-109)
---
# Model inheritance

Subtasks run on the parent session's model. The runtime reads the parent session's messages from newest to oldest and passes the first provider and model it finds into the child prompt. When that scan finds no model, the child runs without an explicit model.

`agent` picks which agent handles the child; it does not change the model. A child that omits `agent` is handled by the built-in default, `rug-swe`.

Failure shapes when the inherited model is unavailable:

- The child prompt call fails and `subtask_run` returns `status: 'error'`.
- The child returns no text, so the subtask returns `status: 'empty'`.

Either shape leaves `outputText` unreliable, so the dispatch author checks `status` before reading `outputText`.