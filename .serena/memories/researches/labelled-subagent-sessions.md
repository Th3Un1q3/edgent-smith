---
id: researches/labelled-subagent-sessions
L0: "PROPOSAL: a label is a session-scoped alias bound lazily on first subtask_run use from label to child session id; later calls in that session resolve it and continue the child. It names what the child does, not a persona."
---
## Idea
A label names a child the orchestrator already started, scoped to that session alone: the first subtask_run call with a label creates the child and records label -> child session id; later calls with that label resolve to the id and continue it as a resume does. It is not a persona but a name for what the child does (memory-manager, reviewer, researcher); what it has become is its own accumulation.

## Shape
1. Map: label -> child id, held by the orchestrator session; not global, not durable, gone with it.
2. Lazy bind and resolution: the first call carrying a label creates the child and records label -> id — no pre-declaration, no registry entry, no setup call — and a later call with that label continues that child as a resume does.
3. No persona: an unknown label resolves nothing — no agent card, no skill bundle, no fixed role; the caller passes agent and skills as on any dispatch.
4. Aliases: task_id is the opaque handle the call returns; a label is a session-scoped alias for a child session id, enough for a caller holding no handle. fork_from is unaffected.
5. Lifecycle: created on first labelled use, retired when the orchestrator session ends; a new session introduces the label lazily and may bind it elsewhere.
6. Conflict: a second call carrying a label whose child still runs — DESIGN CHOICE: refuse it and name the running child; queueing hides latency, forking breaks the alias.
7. Audit: label, child id and turn are recorded for the orchestrator to read back, so descent finds the child.

## Where it lives
- `.agents/skills/task-delegation/` — PROPOSED: choosing and reusing a label in the dispatcher's session.
- `.opencode/agents/` — PROPOSED: cards that mint labels; no card is resolved from one.
- `scripts/conductor/` — PROPOSED: the session-scoped map for Conductor runs.
- `justfile` — PROPOSED: a read-only view of the session's bindings.
- `workflows/` — PROPOSED: labelled dispatch stages.

## Grounding
- Session store /home/vscode/.local/share/opencode/opencode.db, 5.6 GB SQLite — source: that file.
- 7,245 session and 11,627 session_v2 rows (2026-06-17 to 2026-11-24), descent via session.parent_id — source: that file.
- A dispatch is a task tool part with inputs [description, prompt, subagent_type, skills]; a prompt sits in 6,696 of 6,889 — source: same file.
- subtask_run takes prompt, description, agent, skills, task_id, fork_from, timeout_minutes, schema; task_id resume keeps context and state — source: its schema, no repo path.
- git add/commit/push are gated writes needing the user's authorization this session; a denial is final — source: /workspace/AGENTS.md.
- A closing PASS comes from a session that did not produce the artifact — source: UNVERIFIED path.

## Related memories
- mem:researches/about — the index this entry is filed under; its row follows the L0.

## Open questions
- Where does the map live so a compacted orchestrator can read it?
- Does a finished child stay resolvable, or does completion retire the alias?
- Does the conflict rule apply to a fork_from call carrying the same label?
- How is one name shown in audit when it was bound twice in a session?

## Risks
- Reusing a label for another job: the child's context no longer matches the name.
- Unbounded growth: a long-lived child in one session accumulates every turn.
- Drift: the label stops describing what the child does, and the orchestrator trusts the name.
- Two orchestrators in one tree can bind one name to different children; scoping removes only cross-session collision.

## First step
From the 6,889 parts take one orchestrator session and one repeated dispatch; its verbatim preamble repeat count is the baseline a label must beat.