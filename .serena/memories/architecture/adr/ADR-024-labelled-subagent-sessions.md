---
id: ADR-024
title: Labelled subagent sessions bind a label to one child session id
status: accepted
date: 2026-11-24
scope: OpenCode workflow plugin — subtask_run label aliases
---

# ADR-024: Labelled subagent sessions bind a label to one child session id

## Context

Today a caller resumes a child only by passing `task_id`. `SubtaskResult` already returns it (`workflow.ts:311-318`) and the schema accepts it (`contracts.ts:68`), but an orchestrator that lost the value to compaction, or to a turn long enough to drop its own earlier output, cannot resume a child it started. Its only recovery is a fresh dispatch, which discards the context that child accumulated.

A label cannot travel the way the id does: the workflow plugin rebuilds its tool context on every call (`workflow.ts:287-298`), so a module-level map is empty at the next dispatch, and plugin memory dies at compaction. The binding needs a session-scoped store the plugin writes on each bind and reads per dispatch, across `subtask_run`, `subtask_ls` and `subtask_outputs`, the set fixed by `mem:architecture/adr/ADR-023-subtask-outputs-session-message-source`.

The schema declares `label` and `fork_from` as independent optional fields with no exclusion (`workflow.ts:215-216`), so the plugin adds that exclusion itself. `subtask_ls` also identifies a child by an 80-character description, so a label must beat a description the caller could read anyway.

Source: `.opencode/plugins/workflow.ts` and `.opencode/plugins/workflow/contracts.ts`; the line references come from the 2026-11-24 design review.

## Decision

A label is a session-scoped alias from a short name to one child session id, bound lazily by the first `subtask_run` call carrying it. No registration step precedes it.

- **State carrier.** The binding lives in the session entry `workflow.labels`, mapping label to child session id. The plugin writes it on every bind and reads it per dispatch, so it survives the context rebuild and compaction.
- **Resume.** A label whose child has finished resumes that child, never replaces it; that accumulated context is the point of the alias.
- **Scope.** Any agent holding `subtask_run` may use a label.
- **No rebinding.** One label, one child, for the session's life. A dead child makes the name dead, and a later call is refused naming the child.
- **Validation.** Labels match `^[a-z][a-z0-9._-]{0,31}$` and are rejected rather than normalized, so one name never silently becomes two children.
- **Live conflict.** A second call on a label whose child is still running is refused, naming the running child. The plugin neither queues it (queueing hides latency behind the name) nor forks (forking breaks the alias).
- **Exclusion.** `label` and `fork_from` are mutually exclusive; the plugin rejects a call carrying both.

## Consequences

+ An orchestrator that lost a child's id resumes it by name after compaction, and a retry re-prompts the same child instead of starting over.
+ A dispatching agent writes one name per role instead of a UUID it must copy correctly.
- The plugin owns the lifecycle: entry write per bind, read per dispatch, conflict refusal, and an audit row per bind recording label, child id and bind time.
- Known limits: no cross-session labels, no persona or agent resolution from a label, durability only as long as the session entry, and one extra entry write per labelled dispatch.

## Alternatives considered

- **In-memory module `Map`** — dies on reload and stays invisible after compaction.
- **Last-write-wins rebinding** — leaves two children under one name.
- **Refuse-on-finished** — kills the accumulated-context use case.
- **A JSON file per session** — a new disk lifecycle to create, clean and bound.
- **Queueing, or fork-on-conflict** — both keep the name but hide when the named child ran, or create a second child under it.
