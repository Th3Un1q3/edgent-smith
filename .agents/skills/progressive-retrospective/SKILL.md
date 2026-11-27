---
name: progressive-retrospective
description: Load when a run reaches the retrospective stage and must close, because the session runs the retrospective command after the last validation and closes on RETROSPECTIVE_COMPLETE.
---

# Progressive Retrospective

Retrospective stage: close the run.

The retrospective stage is owned by [Retrospective: Prompt the Command](../task-delegation/workflows/task-delegation-workflow.md#retrospective-prompt-the-command) in the `task-delegation` workflow: it runs the retrospective command after the last validation and closes on `RETROSPECTIVE_COMPLETE`.
