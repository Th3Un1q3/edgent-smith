---
id: ADR-023
title: subtask_outputs reads child session messages; subtask_tail removed
status: accepted
date: 2026-11-24
scope: OpenCode workflow plugin — subtask execution surface
---

# ADR-023: subtask_outputs reads child session messages; subtask_tail removed

Supersedes the trio clause of `mem:architecture/adr/ADR-012-standalone-subtask-trio` — its allowlist `[subtask_run, subtask_ls, subtask_tail]` and its Q2 tail-storage limits. Every other ADR-012 decision stands, so ADR-012 keeps status `accepted`; a reader meeting `subtask_tail` there reads it as superseded here.

## Context

The workflow plugin held tail output in a process-local `Map` fed by `recordTailOutput` on every `subtask_run`: 5 entries per task, 24h TTL, 1000 task ids. That store died with the plugin process, so a restart erased every child output, and the plugin kept a copy of content the child session already owned. The operator authorized this breaking change and required the doc and instruction propagation named below.

Source: `.opencode/plugins/workflow.ts`, `.opencode/plugins/workflow/subtask-outputs.ts`, `.opencode/plugins/tests/workflow/subtask-outputs.test.ts` (read 2026-11-24).

## Decision

`subtask_outputs` replaces `subtask_tail`, and `subtask_tail`, `recordTailOutput` and the `Map` store are deleted. Data source: the plugin reads the child session's assistant messages through the client `message.list`, because a task id IS a child session id. One page `{sessionID: task_id, type: 'assistant', order: 'desc', limit: 5}`, then entries sorted by `time.created` ascending and sliced to the requested count, so the caller receives the newest N in oldest-first order. Durability: the content lives in the session store, so outputs survive a plugin restart and are bounded by that store's retention rather than by a 24h timer.

Input and limit contract:

- `task_id` string, `minLength: 1`; `count` integer 1..5, default 3.
- An absent, empty or unknown id returns `[]`, and a throwing client call returns `[]` — no `NOT_FOUND` code and no thrown error.
- Each entry is `{task_id, outputText, sent_at, status}`; `status` is `error` when the message carries `error` or finishes `error`/`content-filter`, `ok` otherwise. `outputText` joins the message's non-empty text parts; metadata adds `total_messages`.
- At most 5 entries per call: the read is one page of 5, never a full transcript walk.

Tool allowlist after this decision is exactly `subtask_ls`, `subtask_run`, `subtask_outputs`. The `subtask_*` wildcard stays denied and no fourth tool joins the trio.

Propagation the operator required once the code landed: `docs/workflow-tool.md`, `.opencode/agents/rug.md` (dispatch table, toolset list, retrieval ladder), `.agents/skills/task-delegation/SKILL.md` and `.agents/skills/task-delegation/workflows/task-delegation-workflow.md`.

## Consequences

+ A verifier dispatched after a plugin restart still reads the child's last assistant message.
- A child session pruned from the session store returns `[]`, indistinguishable from an id that never existed; a caller treats empty as "nothing retrievable", not "the child produced nothing".
- Retrieval cost moves from plugin memory to one `message.list` call per read.
